const mqtt = require('mqtt');
const TuyaDevice = require('./tuyaapi-extended');
const CronJob = require('cron').CronJob;
const crypto = require('crypto');
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
    console.log("MQTT Subscribed");
    updateDeviceStatus();
})

function createHash(tuyaID, tuyaKey, tuyaIP) {
    return crypto.createHmac('sha256', "")
        .update(tuyaID + tuyaKey + tuyaIP)
        .digest('hex');
}

function isKnowDevice(tuyaID, tuyaKey, tuyaIP) {
    var isKnown = false;
    var searchKey = createHash(tuyaID, tuyaKey, tuyaIP);
    if (autoUpdate[searchKey] != undefined) {
        isKnown = true;
    }
    return isKnown;
}
function getKnownDevice(tuyaID, tuyaKey, tuyaIP) {
    var searchKey = createHash(tuyaID, tuyaKey, tuyaIP);
    return autoUpdate[searchKey];
}
function addDevice(key, device) {
    autoUpdate[key] = device;
}
function createDevice(tuyaID, tuyaKey, tuyaIP, tuyaType) {
    if (tuyaID != undefined && tuyaKey != undefined) {
        var tuya = undefined;
        if (isKnowDevice(tuyaID, tuyaKey, tuyaIP)) {
            tuya = getKnownDevice(tuyaID, tuyaKey, tuyaIP);
        } else {
            var key = createHash(tuyaID, tuyaKey, tuyaIP);
            var tuya = new TuyaDevice({
                id: tuyaID,
                key: tuyaKey,
                ip: tuyaIP,
                type: tuyaType
            });
            addDevice(key, tuya);
        }
        return tuya;
    }
    return undefined;
};

client.on('message', function (topic, message) {
    try {
        var topic = topic.split("/");
        var type = topic[1];
        var exec = topic[5];
        if (type == "socket" && exec == "command" && topic.length == 7) {
            var tuya = createDevice(topic[2], topic[3], topic[4], type);
            tuya.onoff(topic[6], function (status) {
                publishStatus(tuya, bmap(status));
            });
        }
        if (type == "lightbulb" && exec == "command" && topic.length == 7) {
            var tuya = createDevice(topic[2], topic[3], topic[4], type);
            tuya.onoff(topic[6], function (status) {
                publishStatus(tuya, bmap(status));
            });
        }
        if (type == "lightbulb" && exec == "color" && topic.length == 6) {
            message = message.toString();
            message = message.toLowerCase();
            var tuya = createDevice(topic[2], topic[3], topic[4]);
            tuya.setColor(message);
        }
    } catch (e) {
        console.error(e);
    }
});


function publishStatus(tuya, status) {
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
        console.error(e);
    }
}

new CronJob('0 */10 * * * *', function () {
    updateDeviceStatus();
}, null, true, 'America/Los_Angeles');