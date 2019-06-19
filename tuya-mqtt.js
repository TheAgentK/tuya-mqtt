const mqtt = require('mqtt');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('TuyAPI:mqtt');
const debugColor = require('debug')('TuyAPI:mqtt:color');
const debugTuya = require('debug')('TuyAPI:mqtt:device');
const debugError = require('debug')('TuyAPI:mqtt:error');
var cleanup = require('./cleanup').Cleanup(onExit);

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

function boolToString(istate) {
    return istate ? 'true' : "false";
}

var connected = undefined;
var CONFIG = undefined;

try {
    CONFIG = require("./config");
} catch (e) {
    console.error("Configuration file not found")
    debugError(e)
    process.exit(1)
}

if (typeof CONFIG.qos == "undefined") {
    CONFIG.qos = 2;
}
if (typeof CONFIG.retain == "undefined") {
    CONFIG.retain = false;
}

const mqtt_client = mqtt.connect({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.mqtt_user,
    password: CONFIG.mqtt_pass,
});

mqtt_client.on('connect', function (err) {
    debug("Verbindung mit MQTT-Server hergestellt");
    connected = true;
    var topic = CONFIG.topic + '#';
    mqtt_client.subscribe(topic, {
        retain: CONFIG.retain,
        qos: CONFIG.qos
    });
});

mqtt_client.on("reconnect", function (error) {
    if (connected) {
        debug("Verbindung mit MQTT-Server wurde unterbrochen. Erneuter Verbindungsversuch!");
    } else {
        debug("Verbindung mit MQTT-Server konnte nicht herrgestellt werden.");
    }
    connected = false;
});

mqtt_client.on("error", function (error) {
    debug("Verbindung mit MQTT-Server konnte nicht herrgestellt werden.", error);
    connected = false;
});

/**
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
 * check mqtt-topic string for old notation with included device type
 * @param {String} topic
 */
function checkTopicForOldNotation(_topic) {
    var topic = _topic.split("/");
    var type = topic[1];
    var result = (type == "socket" || type == "lightbulb");
    return result;
}

/**
 * get action from mqtt-topic string
 * @param {String} topic
 * @returns {String} action type
 */
function getActionFromTopic(_topic) {
    var topic = _topic.split("/");

    if (checkTopicForOldNotation(_topic)) {
        return topic[5];
    } else {
        return topic[4];
    }
}

/**
 * get device informations from mqtt-topic string
 * @param {String} topic
 * @returns {String} object.id
 * @returns {String} object.key
 * @returns {String} object.ip
 */
function getDeviceFromTopic(_topic) {
    var topic = _topic.split("/");

    if (checkTopicForOldNotation(_topic)) {
        return {
            id: topic[2],
            key: topic[3],
            ip: topic[4],
            type: topic[1]
        };
    } else {
        return {
            id: topic[1],
            key: topic[2],
            ip: topic[3]
        };
    }
}

/**
 * get command from mqtt - topic string
 * converts simple commands to TuyAPI JSON commands
 * @param {String} topic
 * @returns {Object}
 */
function getCommandFromTopic(_topic, _message) {
    var topic = _topic.split("/");
    var command = null;

    if (checkTopicForOldNotation(_topic)) {
        command = topic[6];
    } else {
        command = topic[5];
    }

    if (command == null) {
        command = _message;
    }

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

mqtt_client.on('message', function (topic, message) {
    try {
        message = message.toString();
        var action = getActionFromTopic(topic);
        var options = getDeviceFromTopic(topic);

        debug("receive settings", JSON.stringify({
            topic: topic,
            action: action,
            message: message,
            options: options
        }));
        if (options.ip == "discover") {
            delete options.ip
        }
        var device = new TuyaDevice(options);
        device.then(function (params) {
            var device = params.device;

            switch (action) {
                case "command":
                    var command = getCommandFromTopic(topic, message);
                    debug("receive command", command);
                    if (command == "toggle") {
                        device.switch(command).then((data) => {
                            debug("set device status completed", data);
                        });
                    } else {
                        device.set(command).then((data) => {
                            debug("set device status completed", data);
                        });
                    }
                    break;
                case "color":
                    var color = message.toLowerCase();
                    debugColor("set color: ", color);
                    device.setColor(color).then((data) => {
                        debug("set device color completed", data);
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

/**
 * Publish current TuyaDevice state to MQTT-Topic
 * @param {TuyaDevice} device
 * @param {boolean} status
 */
function publishStatus(device, status) {
    if (mqtt_client.connected == true) {
        try {
            var type = device.type;
            var tuyaID = device.options.id;
            var tuyaKey = device.options.key;
            var tuyaIP = device.options.ip;

            if (typeof tuyaIP == "undefined") {
                tuyaIP = "discover"
            }

            if (typeof tuyaID != "undefined" && typeof tuyaKey != "undefined") {
                var topic = CONFIG.topic;
                if (typeof type != "undefined") {
                    topic += type + "/";
                }
                topic += tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";

                mqtt_client.publish(topic, status, {
                    retain: CONFIG.retain,
                    qos: CONFIG.qos
                });
                debugTuya("mqtt status updated to:" + topic + " -> " + status);
            } else {
                debugTuya("mqtt status not updated");
            }
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
            var type = device.type;
            var tuyaID = device.options.id;
            var tuyaKey = device.options.key;
            var tuyaIP = device.options.ip;

            if (typeof tuyaIP == "undefined") {
                tuyaIP = "discover"
            }

            if (typeof tuyaID != "undefined" && typeof tuyaKey != "undefined") {
                var baseTopic = CONFIG.topic;
                if (typeof type != "undefined") {
                    baseTopic += type + "/";
                }
                baseTopic += tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/dps";

                var topic = baseTopic;
                var data = JSON.stringify(dps);
                debugTuya("mqtt dps updated to:" + topic + " -> ", data);
                mqtt_client.publish(topic, data, {
                    retain: CONFIG.retain,
                    qos: CONFIG.qos
                });

                Object.keys(dps).forEach(function (key) {
                    var topic = baseTopic + "/" + key;
                    var data = JSON.stringify(dps[key]);
                    debugTuya("mqtt dps updated to:" + topic + " -> dps[" + key + "]", data);
                    mqtt_client.publish(topic, data, {
                        retain: CONFIG.retain,
                        qos: CONFIG.qos
                    });
                });
            } else {
                debugTuya("mqtt dps not updated");
            }
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
            debugTuya('Data from device ' + this.type + ' :', data);
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
 * MQTT connection tester
 */
function MQTT_Tester() {
    this.interval = null;

    function mqttConnectionTest() {
        if (mqtt_client.connected != connected) {
            connected = mqtt_client.connected;
            if (connected) {
                debug('MQTT-Server verbunden.');
            } else {
                debug('MQTT-Server nicht verbunden.');
            }
        }
    }

    this.destroy = function () {
        clearInterval(this.interval);
        this.interval = undefined;
    }

    this.connect = function () {
        this.interval = setInterval(mqttConnectionTest, 1500);
        mqttConnectionTest();
    }

    var constructor = (function (that) {
        that.connect.call(that);
    })(this);
}
var tester = new MQTT_Tester();

/**
 * Function call on script exit
 */
function onExit() {
    TuyaDevice.disconnectAll();
    if (tester) tester.destroy();
};
