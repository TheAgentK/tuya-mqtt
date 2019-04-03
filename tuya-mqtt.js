const mqtt = require('mqtt');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('tuya-mqtt');
const debugColor = require('debug')('color');
const debugMqtt = require('debug')('mqtt');
const debugTuya = require('debug')('tuyAPI-Events');
const debugError = require('debug')('error');
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
    debugMqtt("Verbindung mit MQTT-Server hergestellt");
    connected = true;
    var topic = CONFIG.topic + '#';
    mqtt_client.subscribe(topic, {
        retain: CONFIG.retain,
        qos: CONFIG.qos
    });
});

mqtt_client.on("reconnect", function (error) {
    if (connected) {
        debugMqtt("Verbindung mit MQTT-Server wurde unterbrochen. Erneuter Verbindungsversuch!");
    } else {
        debugMqtt("Verbindung mit MQTT-Server konnte nicht herrgestellt werden.");
    }
    connected = false;
});

mqtt_client.on("error", function (error) {
    debugMqtt("Verbindung mit MQTT-Server konnte nicht herrgestellt werden.", error);
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

function convert_Message(message) {
    var status2 = message.toString();
    status2 = status2.toLowerCase();
    return status2;
}

mqtt_client.on('message', function (topic, message) {
    try {
        var cMessage = convertMessage(message);
        var dps_message = convert_Message(message);
        var topic = topic.split("/");
        var options = {
            type: topic[1],
            id: topic[2],
            key: topic[3],
            ip: topic[4],
        };
        var exec = topic[5];

        if (options.type == "socket" || options.type == "lightbulb") {
            debug("device", options);
            if(exec == "command") {
                if(topic[6] == null) {
                    debug("message", cMessage);
                } else {
                    debug("message", topic[6]);
                }
            } else {
                if(exec == "dpsJ") debug("message", dps_message);
            }

            var device = new TuyaDevice(options);

            if (exec == "command") {
                var status = topic[6];
                if (status == null) {
                    device.switch(cMessage);
                } else {
                    device.switch(status);
                }
            }
            // TheAgent uses the topic dps to return DPS values back to the user so if you use
            // this as a topic you will create a loop, DO NOT USE dps as a topic
            if (exec == "dpsJ") {
                var status3 = topic[6];
                if(status3 == null) {
                    debug("dps_message:", dps_message);
                    device.multiple_set(JSON.parse(dps_message));
                } else {
                    debug("status3:", status3);
                    device.multiple_set(JSON.parse(status3));
                }
            }

            if (exec == "color") {
                var color = message.toString();
                color = color.toLowerCase();
                debugColor("topic: ", topic);
                debugColor("onColor: ", color);
                device.setColor(color);
            }

        }
    } catch (e) {
        debugError(e);
    }
});
//
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
        debugTuya('Data from device ' + this.type + ' :', data);
        var status = data.dps['1'];
        if (typeof status != "undefined") {
            publishStatus(this, bmap(status));
        }
        publishDPS(this, data.dps);
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
                debugMqtt('MQTT-Server verbunden.');
            } else {
                debugMqtt('MQTT-Server nicht verbunden.');
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
