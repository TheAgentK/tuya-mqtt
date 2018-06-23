const mqtt = require('mqtt');
const TuyaDevice = require('./tuya-connector');
const CronJob = require('cron').CronJob;
const autoUpdate = [];

/**
 * MQTT Settings
 */
var Topic = '#'; //subscribe to all topics
var options = {
    clientId: 'tuya_mqtt',
    port: 1883,
    keepalive: 60
};
const client = mqtt.connect({
    host: 'localhost',
    port: 1883
});

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

client.on('connect', function () {
    var topic = 'tuya/#';
    client.subscribe(topic);
})

var knowDevice = function (tuyaID, tuyaKey, tuyaIP) {
    var isKnown = false;
    autoUpdate.forEach(function (entry) {
        if (entry.id == tuyaID && entry.key == tuyaKey && entry.ip == tuyaIP) {
            isKnown = true;
        }
    });
    return isKnown;
}
var addDevice = function (tuyaID, tuyaKey, tuyaIP) {
    var newDevice = {
        id: tuyaID,
        key: tuyaKey,
        ip: tuyaIP
    };
    autoUpdate.push(newDevice);
}

exports.publishStatus = function (tuyaID, tuyaKey, tuyaIP, status) {
    if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
        var topic = "tuya/socket/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";
        client.publish(topic, status, {
            retain: true,
            qos: 2
        });
    }
}

exports.setStatus = function (tuyaID, tuyaKey, tuyaIP, status) {
    if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
        if (!knowDevice(tuyaID, tuyaKey, tuyaIP)) {
            addDevice(tuyaID, tuyaKey, tuyaIP);
        }
        TuyaDevice.createDevice(tuyaID, tuyaKey, tuyaIP);
        if (TuyaDevice.hasDevice()) {
            TuyaDevice.setStatus(status, function (newStatus) {
                module.exports.publishStatus(tuyaID, tuyaKey, tuyaIP, newStatus);
            });
        }
    }
}

exports.getStatus = function (tuyaID, tuyaKey, tuyaIP) {
    if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
        TuyaDevice.createDevice(tuyaID, tuyaKey, tuyaIP);
        if (TuyaDevice.hasDevice()) {
            TuyaDevice.getStatus(function (status) {
                module.exports.publishStatus(tuyaID, tuyaKey, tuyaIP, bmap(status));
            })
        }
    }
}

client.on('message', function (topic, message) {
    try {
        var topic = topic.split("/");
        var type = topic[1];
        var exec = topic[5];
        if (type == "socket" && exec == "command" && topic.length == 7) {
            module.exports.setStatus(topic[2], topic[3], topic[4], topic[6]);
        }
    } catch (e) {
        console.error(e);
    }
});

new CronJob('0 */1 * * * *', function () {
    try {
        autoUpdate.forEach(function (entry) {
            module.exports.getStatus(entry.id, entry.key, entry.ip);
        });
    } catch (e) {
        console.error(e);
    }
}, null, true, 'America/Los_Angeles');