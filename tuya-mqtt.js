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
    console.log("MQTT Subscribed");
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
var addDevice = function (type, tuyaID, tuyaKey, tuyaIP) {
    var newDevice = {
        id: tuyaID,
        key: tuyaKey,
        ip: tuyaIP,
        type: type
    };
    autoUpdate.push(newDevice);
}

exports.publishStatus = function (tuyaID, tuyaKey, tuyaIP, type, status) {
    if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
        var topic = "tuya/" + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";
        client.publish(topic, status, {
            retain: true,
            qos: 2
        });
    }
}

exports.setStatus = function (type, tuyaID, tuyaKey, tuyaIP, status) {
    if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
        if (!knowDevice(tuyaID, tuyaKey, tuyaIP)) {
            addDevice(type, tuyaID, tuyaKey, tuyaIP);
        }
        TuyaDevice.createDevice(tuyaID, tuyaKey, tuyaIP);
        if (TuyaDevice.hasDevice()) {
            TuyaDevice.setStatus(status, function (newStatus) {
                module.exports[type].publishStatus(tuyaID, tuyaKey, tuyaIP, newStatus);
            });
        }
    }
}

exports.getStatus = function (type, tuyaID, tuyaKey, tuyaIP) {
    if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
        TuyaDevice.createDevice(tuyaID, tuyaKey, tuyaIP);
        if (TuyaDevice.hasDevice()) {
            TuyaDevice.getStatus(function (status) {
                module.exports[type].publishStatus(tuyaID, tuyaKey, tuyaIP, bmap(status));
            })
        }
    }
}

exports.socket = {};
exports.socket.publishStatus = function (tuyaID, tuyaKey, tuyaIP, status) {
    return module.exports.publishStatus(tuyaID, tuyaKey, tuyaIP, "socket", status);
}

exports.lightbulb = {};
exports.lightbulb.publishStatus = function (tuyaID, tuyaKey, tuyaIP, status) {
    return module.exports.publishStatus(tuyaID, tuyaKey, tuyaIP, "lightbulb", status);
}
exports.lightbulb.publishColor = function (tuyaID, tuyaKey, tuyaIP, color) {
    if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
        var topic = "tuya/lightbulb/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state/color";
        client.publish(topic, color, {
            retain: true,
            qos: 2
        });
    }
}
exports.lightbulb.setColor = function (tuyaID, tuyaKey, tuyaIP, color) {
    if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
        if (!knowDevice(tuyaID, tuyaKey, tuyaIP)) {
            //addDevice("lightbulb", tuyaID, tuyaKey, tuyaIP);
        }
        TuyaDevice.createDevice(tuyaID, tuyaKey, tuyaIP);
        if (TuyaDevice.hasDevice()) {
            console.log("tuya-mqtt.lightbulb.setColor: " + color);
            TuyaDevice.setColor(color, function (newStatus) {
                console.log(newStatus);
                module.exports.lightbulb.publishColor(tuyaID, tuyaKey, tuyaIP, newStatus);
            });
        }
    }
}

client.on('message', function (topic, message) {
    try {
        var topic = topic.split("/");
        var type = topic[1];
        var exec = topic[5];
        if (type == "socket" && exec == "command" && topic.length == 7) {
            module.exports.setStatus(type, topic[2], topic[3], topic[4], topic[6]);
        }
        if (type == "lightbulb" && exec == "command" && topic.length == 7) {
            module.exports.setStatus(type, topic[2], topic[3], topic[4], topic[6]);
        }
        if (type == "lightbulb" && exec == "color" && topic.length == 6) {
            message = message.toString();
            message = message.toLowerCase();
            module.exports.lightbulb.setColor(topic[2], topic[3], topic[4], message);
        }
    } catch (e) {
        console.error(e);
    }
});

new CronJob('0 */1 * * * *', function () {
    try {
        autoUpdate.forEach(function (entry) {
            module.exports.getStatus(entry.type, entry.id, entry.key, entry.ip);
        });
    } catch (e) {
        console.error(e);
    }
}, null, true, 'America/Los_Angeles');