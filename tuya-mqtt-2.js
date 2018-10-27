const mqtt = require('mqtt');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('tuya-mqtt');
var cleanup = require('./cleanup').Cleanup(onExit);

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

const CONFIG = {
    host: 'localhost',
    port: 1883,
    topic: "tuya/"
}

const mqtt_client = mqtt.connect({
    host: CONFIG.host,
    port: CONFIG.port
});

mqtt_client.on('connect', function () {
    var topic = CONFIG.topic + '#';
    mqtt_client.subscribe(topic, function (err) {
        if (!err) {
            //mqtt_client.publish(CONFIG.topic + 'presence', 'Hello mqtt')
        }
    });
});

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

function publishStatus(device, status) {
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

TuyaDevice.onAll('data', function (data) {
    debug('Data from device ' + this.type + ' :', data);
    var status = data.dps['1'];
    if (this.type == "lightbulb" && status == undefined) {
        status = true;
    }
    publishStatus(this, bmap(status));
});

// defines app specific callback...
function onExit() {
    TuyaDevice.disconnectAll();
};