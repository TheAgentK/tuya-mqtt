const fs = require('fs')
const mqtt = require('mqtt');
const json5 = require('json5');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('TuyAPI:mqtt');
const debugColor = require('debug')('TuyAPI:mqtt:color');
const debugTuya = require('debug')('TuyAPI:mqtt:device');
const debugError = require('debug')('TuyAPI:mqtt:error');
var cleanup = require('./cleanup').Cleanup(onExit);

var CONFIG = undefined;
var mqtt_client = undefined;

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

/*
 * execute function on topic message
 */

function IsJsonString(text) {
    if (/^[\],:{}\s]*$/.test(text.replace(/\\["\\\/bfnrtu]/g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
        //the json is ok
        return true;
    }
    return false;
}

/**
 * get command from mqtt message
 * converts message to TuyAPI JSON commands
 * @param {String} message
 * @returns {Object}
 */
function getCommandFromMessage(_message) {
    let command = _message

    if (command != "1" && command != "0" && IsJsonString(command)) {
        debug("command is JSON");
        command = JSON.parse(command);
    } else {
        if (command.toLowerCase() != "toggle") {
            // convert simple commands (on, off, 1, 0) to TuyAPI-Commands
            var convertString = command.toLowerCase() == "on" || command == "1" || command == 1 ? true : false;
            command = {
                set: convertString
            }
        } else {
            command = command.toLowerCase();
        }
    }
    return command;
}

/**
 * Publish current TuyaDevice state to MQTT-Topic
 * @param {TuyaDevice} device
 * @param {boolean} status
 */
function publishStatus(device, status) {
    if (mqtt_client.connected == true) {
        try {
            let topic = CONFIG.topic + device.topicLevel + "/state";
            mqtt_client.publish(topic, status, {
                retain: CONFIG.retain,
                qos: CONFIG.qos
            });
            debugTuya("mqtt status updated to:" + topic + " -> " + status);
        } catch (e) {
            debugError(e);
        }
    }
}

function publishColorState(device, state) {

}

/**
 * publish all dps-values to topic
 * @param  {TuyaDevice} device
 * @param  {Object} dps
 */
function publishDPS(device, dps) {
    if (mqtt_client.connected == true) {
        try {
            const baseTopic = CONFIG.topic + device.topicLevel + "/dps";

            const topic = baseTopic;
            const data = JSON.stringify(dps);
            debugTuya("mqtt dps updated to:" + topic + " -> ", data);
            mqtt_client.publish(topic, data, {
                retain: CONFIG.retain,
                qos: CONFIG.qos
            });

            Object.keys(dps).forEach(function (key) {
                const topic = baseTopic + "/" + key;
                const data = JSON.stringify(dps[key]);
                debugTuya("mqtt dps updated to:" + topic + " -> dps[" + key + "]", data);
                mqtt_client.publish(topic, data, {
                    retain: CONFIG.retain,
                    qos: CONFIG.qos
                });
            });
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
            var status = data.dps['1'];
            if (typeof status != "undefined") {
                publishStatus(this, bmap(status));
            }
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
        tuyaDevices = fs.readFileSync('./devices.json', 'utf8');
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
            splitTopic = topic.split("/");
            let action = splitTopic[2];
            let options = {
                topicLevel: splitTopic[1]
            }

            debug("receive settings", JSON.stringify({
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
                        var command = getCommandFromMessage(message);
                        debug("Received command: ", command);
                        if (command == "toggle") {
                            device.switch(command).then((data) => {
                                debug("Set device status completed: ", data);
                            });
                        }
                        if (command.schema === true) {
                            // Trigger device schema update to update state
                            device.schema(command).then((data) => {
                            });
                            debug("Get schema status command complete");
                        } else {
                            device.set(command).then((data) => {
                                debug("Set device status completed: ", data);
                            });
                        }
                        break;
                    case "color":
                        var color = message.toLowerCase();
                        debugColor("Set color: ", color);
                        device.setColor(color).then((data) => {
                            debug("Set device color completed: ", data);
                        });
                        break;
                }

            }).catch((err) => {
                debugError(err);
            });
        } catch (e) {
            debugError(e);
        }
    });
}

// Call the main code
main()