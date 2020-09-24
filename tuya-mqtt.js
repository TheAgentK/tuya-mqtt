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
        debug("Received command is JSON");
        command = JSON.parse(command);
    } else {
        switch(command.toLowerCase()) {
            case "on":
            case "off":
            case "0":
            case "1":
                // convert simple commands (on, off, 1, 0) to TuyAPI-Commands
                const convertString = command.toLowerCase() == "on" || command == "1" || command == 1 ? true : false;
                command = {
                    set: convertString
                }
                break;
            default:
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
            device.options.template =
                {
                  "state": { "dpsKey": 1, "dpsType": "bool" },
                  "brightness_state": { "dpsKey": 2, "dpsType": "int", "minVal": 0, "maxVal": 255 }
                }
        }
    } else if (keys === 1) {
        if (typeof dps['1'] === "boolean") {
            // If it only has one value and it's a boolean, it's probably a switch/socket
            device.options.type = "switch"
            device.options.template =
            {
                "state": { "dpsKey": 1, "dpsType": "bool" }
            }
        }
    }

    if (!device.options.type) {
        device.options.type = "unknown"
        device.options.template = 
        {
            "state": { "dpsKey": 1, "dpsType": "bool" }
        }
    }
}

function publishColorState(device, state) {

}

function publishDeviceTopics(device, dps) {
    if (!device.options.template) {
        debugTuya ("No device template found!")
        return 
    }
    const baseTopic = CONFIG.topic + device.topicLevel + "/"
    for (let stateTopic in device.options.template) {
        const template = device.options.template[stateTopic]
        const topic = baseTopic + stateTopic
        let state
        switch (template.dpsType) {
            case "bool":
                state = (dps[template.dpsKey]) ? 'ON' : 'OFF';
                break;
            case "int":
                state = (dps[template.dpsKey])
                state = (state > template.minVal && state < template.maxVal) ? state.toString() : ""
                break;
        }
        if (state) {
            debugTuya("MQTT "+device.options.type+" "+topic+" -> ", state);
            publishMQTT(topic, state);
        }
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
            debugTuya('Data from device Id ' + data.devId + ' ->', data.dps);
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
    for (let tuyaDevice of tuyaDevices) {
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

// Process MQTT commands for all command topics at device level
function processDeviceCommand(message, device, commandTopic) {
    let command = getCommandFromMessage(message);
    // If it's the color command topic handle it manually
    if (commandTopic === "color_command") {
        const color = message.toLowerCase();
        debugColor("Set color: ", color);
        device.setColor(color).then((data) => {
            debug("Set device color completed: ", data);
        });
    } else if (commandTopic === "command" && (command === "toggle" || command === "schema" )) {
        // Handle special commands "toggle" and "schema" to primary device command topic
        debug("Received command: ", command);
        switch(command) {
            case "toggle":
                device.switch(command).then((data) => {
                    debug("Set device status completed: ", data);
                });
                break;
            case "schema":
                // Trigger device schema to update state
                device.schema(command).then((data) => {
                    debug("Get schema status command complete.");
                });
                break;
            }
    } else {
        // Recevied command on device topic level, check for matching device template
        // and process command accordingly
        const stateTopic = commandTopic.replace("command", "state")
        const template = device.options.template[stateTopic]
        if (template) {
            debug("Received device "+commandTopic.replace("_"," "), message);
            const tuyaCommand = new Object()
            tuyaCommand.dps = template.dpsKey
            switch (template.dpsType) {
                case "bool":
                    if (command === "true") {
                        tuyaCommand.set = true
                    } else if (command === "false") {
                        tuyaCommand.set = false
                    } else if (typeof command.set === "boolean") {
                        tuyaCommand.set = command.set
                    } else {
                        tuyaCommand.set = "!!!!!"
                    }
                    break;
                case "int":
                    tuyaCommand.set = (command > template.minVal && command < template.maxVal ) ? parseInt(command) : "!!!!!"
                    break;
            }
            if (tuyaCommand.set === "!!!!!") {
                debug("Received invalid value for ", commandTopic, ", value:", command)
            } else {
                device.set(tuyaCommand).then((data) => {
                    debug("Set device "+commandTopic.replace("_"," ")+": ", data);
                });
            }
        } else {
            debug("Received unknown command topic for device: ", commandTopic)
        }
    }
}

// Process raw Tuya JSON commands via DPS command topic
function processDpsCommand(message, device) {
    if (isJsonString(message)) {
        const command = getCommandFromMessage(message);
        debug("Received command: ", command);
        device.set(command).then((data) => {
            debug("Set device status completed: ", data);
        });
    } else {
        debug("DPS command topic requires Tuya style JSON value")
    }
}

// Process text base Tuya command via DPS key command topics
function processDpsKeyCommand(message, device, dpsKey) {
    if (isJsonString(message)) {
        debug("Individual DPS command topics do not accept JSON values")
    } else {
        const dpsMessage = parseDpsMessage(message)
        debug("Received command for DPS"+dpsKey+": ", message);
        const command = {
            dps: dpsKey,
            set: dpsMessage
        }
        device.set(command).then((data) => {
            debug("Set device status completed: ", data);
        });
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
            const commandTopic = splitTopic[topicLength - 1];
            const options = {
                topicLevel: splitTopic[1]
            }

            // If it looks like a valid command topic try to process it
            if (commandTopic.includes("command")) {
                debug("Receive settings", JSON.stringify({
                    topic: topic,
                    message: message
                }));

                // Uses device topic level to find matching device
                var device = new TuyaDevice(options);

                device.then(function (params) {
                    let device = params.device;
                    switch (topicLength) {
                        case 3:
                            processDeviceCommand(message, device, commandTopic);
                            break;
                        case 4:
                            processDpsCommand(message, device);
                            break;
                        case 5:
                            const dpsKey = splitTopic[topicLength-2]
                            processDpsKeyCommand(message, device, dpsKey);
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