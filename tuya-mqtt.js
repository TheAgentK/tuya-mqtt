const mqtt = require('mqtt');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('tuya-mqtt');
const debugMqtt = require('debug')('mqtt');
var cleanup = require('./cleanup').Cleanup(onExit);

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

var connected = undefined;

const CONFIG = require("./config");

const mqtt_client = mqtt.connect({
    host: CONFIG.host,
    port: CONFIG.port
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
                device.onoff(status);
            }
            if (exec == "color") {
                var color = message;
                device.setColor(color);
            }
        }
    } catch (e) {
        debug(e);
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
                var topic = "tuya/" + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";
                mqtt_client.publish(topic, status, {
                    retain: true,
                    qos: 2
                });
                debug("mqtt status updated to:" + topic + " -> " + status);
            } else {
                debug("mqtt status not updated");
            }
        } catch (e) {
            debug(e);
        }
    }
}

/**
 * event fires if TuyaDevice sends data
 * @see TuyAPI (https://github.com/codetheweb/tuyapi)
 */
TuyaDevice.onAll('data', function (data) {
    debug('Data from device ' + this.type + ' :', data);
    var status = data.dps['1'];
    if (this.type == "lightbulb" && status == undefined) {
        status = true;
    }
    publishStatus(this, bmap(status));
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
    tester.destroy();
};