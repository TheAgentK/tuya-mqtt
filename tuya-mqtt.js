const mqtt = require('mqtt');
const TuyaDevice = require('./tuyaapi-extended');
const CronJob = require('cron').CronJob;
const crypto = require('crypto');
const debug = require('debug')('TuyAPI-mqtt');
const autoUpdate = {};

/**
 * MQTT Settings
 */
var options = {
    clientId: 'tuya_mqtt',
    port: 1883,
    keepalive: 60
};
const client = mqtt.connect({
    host: 'localhost',
    port: options.port
});

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

client.on('connect', function () {
    var topic = 'tuya/#';
    client.subscribe(topic);
    debug("MQTT Subscribed");
    updateDeviceStatus();
})

function createHash(tuyaID, tuyaKey, tuyaIP) {
    try {
        return crypto.createHmac('sha256', "")
            .update(tuyaID + tuyaKey + tuyaIP)
            .digest('hex');
    } catch (e) {
        debug(e);
    }
    return tuyaID + tuyaKey + tuyaIP;
}

function isKnowDevice(tuyaID, tuyaKey, tuyaIP) {
    try {
        var isKnown = false;
        var searchKey = createHash(tuyaID, tuyaKey, tuyaIP);
        if (autoUpdate[searchKey] != undefined) {
            isKnown = true;
        }
        return isKnown;
    } catch (e) {
        debug(e);
    }
}

function getKnownDevice(tuyaID, tuyaKey, tuyaIP) {
    try {
        var searchKey = createHash(tuyaID, tuyaKey, tuyaIP);
        return autoUpdate[searchKey];
    } catch (e) {
        debug(e);
    }
}

function addDevice(device) {
    try {
        var infos = device.getDevice();
        var tuyaID = infos.id;
        var tuyaKey = infos.key;
        var tuyaIP = infos.ip;
        var key = createHash(tuyaID, tuyaKey, tuyaIP);
        autoUpdate[key] = device;
    } catch (e) {
        debug(e);
    }
}

function createDevice(tuyaID, tuyaKey, tuyaIP, tuyaType) {
    try {
        if (tuyaID != undefined && tuyaKey != undefined) {
            var tuya = undefined;
            if (isKnowDevice(tuyaID, tuyaKey, tuyaIP)) {
                tuya = getKnownDevice(tuyaID, tuyaKey, tuyaIP);
            } else {
                var tuya = new TuyaDevice({
                    id: tuyaID,
                    key: tuyaKey,
                    ip: tuyaIP,
                    type: tuyaType
                });
                addDevice(tuya);
            }
            return tuya;
        }
    } catch (e) {
        debug(e);
    }
    return undefined;
};

client.on('message', function (topic, message) {
    try {
        var topic = topic.split("/");
        var type = topic[1];
        var exec = topic[5];

        if ((type == "socket" || type == "lightbulb") && exec == "command" && topic.length == 7) {
            var tuya = createDevice(topic[2], topic[3], topic[4], type);
            tuya.onoff(topic[6], function (status) {
                publishStatus(tuya, bmap(status));
                debug("Device status updated to: " + bmap(status));
            });
        }
        if (type == "lightbulb" && exec == "color" && topic.length == 6) {
            message = message.toString();
            message = message.toLowerCase();
            debug("Recevied color: " + message);
            var tuya = createDevice(topic[2], topic[3], topic[4], type);
            tuya.setColor(message, function (status) {
                publishStatus(tuya, bmap(status));
                debug("Color is updated: " + bmap(status));
            });
        }
    } catch (e) {
        debug(e);
    }
});


function publishStatus(tuya, status) {
    try {
        var device = tuya.getDevice();
        var type = device.type;
        var tuyaID = device.id;
        var tuyaKey = device.key;
        var tuyaIP = device.ip;

        if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
            var topic = "tuya/" + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";
            client.publish(topic, status, {
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

function updateDeviceStatus() {
    try {
        Object.keys(autoUpdate).forEach(function (k) {
            var tuya = autoUpdate[k];
            tuya.getStatus(function (status) {
                publishStatus(tuya, bmap(status));
            })
        });
    } catch (e) {
        debug(e);
    }
}

new CronJob('0 */10 * * * *', function () {
    //updateDeviceStatus();
}, null, true, 'America/Los_Angeles');