const fs = require('fs')
const mqtt = require('mqtt');
const json5 = require('json5');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('TuyAPI:mqtt');
const debugColor = require('debug')('TuyAPI:mqtt:color');
const debugTuya = require('debug')('TuyAPI:mqtt:device');
const debugError = require('debug')('TuyAPI:mqtt:error');

var CONFIG = undefined;
var mqtt_client = undefined;

/*
 * Check if data is JSON or not
 */
function isJsonString (data){
    try {
        const parsedData = JSON.parse(data);
        if (parsedData && typeof parsedData === "object") {
            return parsedData;
        }
    }
    catch (e) { }

    return false;
};

/**
 * get command from mqtt message
 * converts message to TuyAPI JSON commands
 * @param {String} message
 * @returns {Object}
 */
function getCommandFromMessage(_message) {
    let command = _message

    if (command != "1" && command != "0" && isJsonString(command)) {
        debug("command is JSON");
        command = JSON.parse(command);
    } else {
        if (command.toLowerCase() != "toggle") {
            // convert simple commands (on, off, 1, 0) to TuyAPI-Commands
            const convertString = command.toLowerCase() == "on" || command == "1" || command == 1 ? true : false;
            command = {
                set: convertString
            }
        } else {
            command = command.toLowerCase();
        }
    }
    return command;
}

// Parse message
function parseDpsMessage(message) {
    if (typeof message === "boolean" ) {
        return message;
    } else if (message === "true" || message === "false") {
        return (message === "true") ? true : false
    } else if (!isNaN(message)) {
        return Number(message)
    } else {
        return message
    }
}

function publishMQTT(topic, data) {
    mqtt_client.publish(topic, data, {
        retain: CONFIG.retain,
        qos: CONFIG.qos
    });
}

function guessDeviceType(device, dps) {
    keys = Object.keys(dps).length
    if (keys === 2) {
        if (typeof dps['1'] === "boolean" && dps['2'] >= 0 && dps['2'] <= 255) {
            // A "dimmer" is a switch/light with brightness control only
            device.options.type = "dimmer"
        }
    } else if (keys === 1) {
        if (typeof dps['1'] === "boolean") {
            // If it only has one value and it's a boolean, it's probably a switch/socket
            device.options.type = "switch"
        }
    }

    if (!device.options.type) {
        device.options.type = "unknown"
    }
}

function publishColorState(device, state) {

}

function publishDeviceTopics(device, dps) {
    const baseTopic = CONFIG.topic + device.topicLevel
    let state
    let brightness_state
    switch (device.options.type) {
        case "switch":
        case "unknown":
            state = (dps['1']) ? 'ON' : 'OFF';
            topic = baseTopic+"/state"
            debugTuya("MQTT state ("+device.options.type+"): "+topic+" -> ", state);
            publishMQTT(topic, state);
            break;
        case "dimmer":
            if ('1' in dps) {
                state = (dps['1']) ? 'ON' : 'OFF';
                topic = baseTopic+"/state"
                debugTuya("MQTT state ("+device.options.type+"): "+topic+" -> ", state);
                publishMQTT(topic, state);
            }
            if ('2' in dps) {
                brightness_state = JSON.stringify(dps['2']);
                topic = baseTopic+"/brightness_state"
                debugTuya("MQTT brightness ("+device.options.type+"): "+topic+" -> ", brightness_state);
                publishMQTT(topic, brightness_state);
            }
            break;
    }
}

/**
 * publish all dps-values to topic
 * @param  {TuyaDevice} device
 * @param  {Object} dps
 */
function publishDPS(device, dps) {
    if (mqtt_client.connected == true) {
        try {
            if (!device.options.type) {
                guessDeviceType(device, dps)
            }

            const baseTopic = CONFIG.topic + device.topicLevel + "/dps";
            const topic = baseTopic + "/state"
            const data = JSON.stringify(dps);

            // Publish raw DPS JSON data
            debugTuya("MQTT DPS JSON (raw): " + topic + " -> ", data);
            publishMQTT(topic, data);

            // Publish dps/<#>/state value for each DPS
            Object.keys(dps).forEach(function (key) {
                const topic = baseTopic + "/" + key + "/state";
                const data = JSON.stringify(dps[key]);
                debugTuya("MQTT DPS"+key+": "+topic+" -> ", data);
                publishMQTT(topic, data);
            });

            publishDeviceTopics(device, dps)

        } catch (e) {
            debugError(e);
        }
    }
}

/**
 * event fires if TuyaDevice sends data
 * @see TuyAPI (https://github.com/codetheweb/tuyapi)
 */
TuyaDevice.onAll('data', function (data) {
    try {
        if (typeof data.dps != "undefined") {
            debugTuya('Data from device ' + this.tuyID + ' :', data);
            publishDPS(this, data.dps);
        }
    } catch (e) {
        debugError(e);
    }
});

/**
 * Function call on script exit
 */
function onExit() {
    TuyaDevice.disconnectAll();
};

// Simple sleep to pause in async functions
function sleep(sec) {
    return new Promise(res => setTimeout(res, sec*1000));
}

function initTuyaDevices(tuyaDevices) {
    for (const tuyaDevice of tuyaDevices) {
        let options = {
            id: tuyaDevice.id,
            key: tuyaDevice.key
        }
        if (tuyaDevice.name) { options.name = tuyaDevice.name }
        if (tuyaDevice.ip) { 
            options.ip = tuyaDevice.ip
            if (tuyaDevice.version) {
                options.version = tuyaDevice.version
            } else {
                version = "3.1"
            }
        }
        new TuyaDevice(options);
    }
}

// Main code function
const main = async() => {
    let tuyaDevices

    try {
        CONFIG = require("./config");
    } catch (e) {
        console.error("Configuration file not found!")
        debugError(e)
        process.exit(1)
    }

    if (typeof CONFIG.qos == "undefined") {
        CONFIG.qos = 2;
    }
    if (typeof CONFIG.retain == "undefined") {
        CONFIG.retain = false;
    }

    try {
        tuyaDevices = fs.readFileSync('./devices.conf', 'utf8');
        tuyaDevices = json5.parse(tuyaDevices)
    } catch (e) {
        console.error("Devices file not found!")
        debugError(e)
        process.exit(1)
    }

    if (!tuyaDevices.length) {
        console.error("No devices found in devices file!")
        process.exit(1)
    }

    mqtt_client = mqtt.connect({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.mqtt_user,
        password: CONFIG.mqtt_pass,
    });

    mqtt_client.on('connect', function (err) {
        debug("Connection established to MQTT server");
        let topic = CONFIG.topic + '#';
        mqtt_client.subscribe(topic, {
            retain: CONFIG.retain,
            qos: CONFIG.qos
        });
        initTuyaDevices(tuyaDevices)
    });

    mqtt_client.on("reconnect", function (error) {
        if (mqtt_client.connected) {
            debug("Connection to MQTT server lost. Attempting to reconnect...");
        } else {
            debug("Unable to connect to MQTT server");
        }
    });

    mqtt_client.on("error", function (error) {
        debug("Unable to connect to MQTT server", error);
    });

    mqtt_client.on('message', function (topic, message) {
        try {
            message = message.toString();
            const splitTopic = topic.split("/");
            const topicLength = splitTopic.length
            const action = splitTopic[topicLength - 1];
            const options = {
                topicLevel: splitTopic[1]
            }

            // If it looks like a valid command topic try to process it
            if (action.includes("command")) {
                debug("Receive settings", JSON.stringify({
                    topic: topic,
                    action: action,
                    message: message,
                    topicLevel: options.topicLevel
                }));

                // Uses device topic level to find matching device
                var device = new TuyaDevice(options);

                device.then(function (params) {
                    var device = params.device;
                    switch (action) {
                        case "command":
                            if (topicLength === 3) {
                                const command = getCommandFromMessage(message);
                                debug("Received command: ", command);
                                if (command == "toggle") {
                                    device.switch(command).then((data) => {
                                        debug("Set device status completed: ", data);
                                    });
                                }
                                if (command == "schema") {
                                    // Trigger device schema update to update state
                                    device.schema(command).then((data) => {
                                    });
                                    debug("Get schema status command complete");
                                } else {
                                    device.set(command).then((data) => {
                                        debug("Set device status completed: ", data);
                                    });
                                }
                            } else if (topicLength === 4) {
                                if (isJsonString(message)) {
                                    const command = getCommandFromMessage(message);
                                    debug("Received command: ", command);
                                    device.set(command).then((data) => {
                                        debug("Set device status completed: ", data);
                                    });
                                } else {
                                    debug("DPS command topic requires Tuya style JSON value")
                                }
                            } else if (topicLength === 5) {
                                if (isJsonString(message)) {
                                    debug("Individual DPS command topics require string value")
                                } else {
                                    const dpsMessage = parseDpsMessage(message)
                                    debug("Received DPS "+splitTopic[topicLength-2]+" command: ", message);
                                    const command = {
                                        dps: splitTopic[topicLength-2],
                                        set: dpsMessage
                                    }
                                    device.set(command).then((data) => {
                                        debug("Set device status completed: ", data);
                                    });
                                }
                            }
                            break;
                        case "color":
                            const color = message.toLowerCase();
                            debugColor("Set color: ", color);
                            device.setColor(color).then((data) => {
                                debug("Set device color completed: ", data);
                            });
                            break;
                        case "brightness_command":
                            if (message >= 0 && message <= 255) {
                                const brightness = {
                                    dps: 2,
                                    set: parseInt(message)
                                }
                                debug("Set brighness: ", message)
                                device.set(brightness).then((data) => {
                                    debug("Set device brightness completed: ",data);
                                });
                            } else {
                                debug("Received invalid brightness value: " + message)
                            }
                            break;
                    }
                }).catch((err) => {
                    debugError(err);
                });
            }
        } catch (e) {
            debugError(e);
        }
    });
}

// Call the main code
main()