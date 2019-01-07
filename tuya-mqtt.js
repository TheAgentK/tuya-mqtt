const mqtt = require('mqtt');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('tuya-mqtt');
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
    mqtt_client.subscribe(topic);
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
mqtt_client.on('message', function (topic, message) {
    try {
        message = message.toString();
        message = message.toLowerCase();
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
            debug("message", message);
            var device = new TuyaDevice(options);

			if (exec == "command") {
				var status = topic[6];
				if ( status == null ) {
					device.onoff(message);
				} else {
					device.onoff(status);
				}
			}
            if (exec == "color") {
                var color = message;
                device.setColor(color);
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

            if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
                var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";
                mqtt_client.publish(topic, status, {
                    retain: true,
                    qos: 2
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

            if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
                var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/dps";
                var data = JSON.stringify(dps);
                debugTuya("mqtt dps updated to:" + topic + " -> ", data);
                mqtt_client.publish(topic, data, {
                    retain: true,
                    qos: 2
                });

                Object.keys(dps).forEach(function (key) {
                    var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/dps/" + key;
                    var data = JSON.stringify(dps[key]);
                    debugTuya("mqtt dps updated to:" + topic + " -> dps[" + key + "]", data);
                    mqtt_client.publish(topic, data, {
                        retain: true,
                        qos: 2
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
        if (this.type == "lightbulb" && status == undefined) {
            status = true;
        }
        publishStatus(this, bmap(status));
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
    if(tester) tester.destroy();
};
