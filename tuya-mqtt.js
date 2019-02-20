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
function boolToString(istate) {
    return istate == 1 ? 'on' : "off";
}

function convertMessage(message) {
    var status = message.toString();
    status = boolToString(status);
    status = status.toLowerCase();
    return status;
}

mqtt_client.on('message', function (topic, message) {
    try {
        var cMessage = convertMessage(message);
        var topic = topic.split("/");
        var type = topic[1];
        var options = {
            id: topic[2],
            key: topic[3],
            ip: topic[4],
        };
        var exec = topic[5];

        var commands = [
            "command",
            "color"
        ]

        if (type == "socket" || type == "lightbulb") {
            if (commands.includes(exec)) {
                var device = new TuyaDevice(options);
                device.then(function (params) {
                    // wait for connection to Device and run commands
                    debug("receive message", cMessage);
                    var device = params.device;

                    if (exec == "command") {
                        var status = topic[6];
                        if (status == null) {
                            device.switch(cMessage).then((data) => {
                                debug("completed");
                            });
                        } else {
                            device.switch(status).then((data) => {
                                debug("completed");
                            });
                        }
                    }
                    if (exec == "color") {
                        var color = message.toString();
                        color = color.toLowerCase();
                        debugColor("topic: ", topic);
                        debugColor("onColor: ", color);
                        device.setColor(color);
                    }
                }).catch((err) => {
                    debugError(err);
                });
            }
        }
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

            if (typeof tuyaID != "undefined" && typeof tuyaKey != "undefined" && typeof tuyaIP != "undefined") {
                var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";
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

            if (typeof tuyaID != "undefined" && typeof tuyaKey != "undefined" && typeof tuyaIP != "undefined") {
                var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/dps";
                var data = JSON.stringify(dps);
                debugTuya("mqtt dps updated to:" + topic + " -> ", data);
                mqtt_client.publish(topic, data, {
                    retain: CONFIG.retain,
                    qos: CONFIG.qos
                });

                Object.keys(dps).forEach(function (key) {
                    var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/dps/" + key;
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