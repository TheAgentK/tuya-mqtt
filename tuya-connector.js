const TuyaDevice = require('tuyapi');
const TuyaStatus = require('./tuya-status');

let tuya = undefined;
_DEBUG = true;

exports.setDebug = function (debug) {
    _DEBUG = debug;
    TuyaStatus.setDebug(debug);
}

exports.createDevice = function (tuyaID, tuyaKey, tuyaIP) {
    if (tuyaID != undefined && tuyaKey != undefined) {
        try {
            var config = {
                id: tuyaID + "",
                key: tuyaKey
            };
            if (tuyaIP != undefined) {
                config.ip = tuyaIP;
            }
            if (_DEBUG) {
                console.log(config);
            }
            tuya = new TuyaDevice(config);
            TuyaStatus.setDevice(tuya);
            return tuya;
        } catch (e) {
            //console.error(e);
            console.error(config);
        }
    }
    return undefined;
};

exports.hasDevice = function () {
    var device = (tuya != undefined);
    if (!device) {
        console.error("Tuya - Device not set");
    }
    return device;
}

exports.setStatus = function (newState, callback) {
    if (this.hasDevice()) {
        if (_DEBUG) {
            console.log('Status: ' + newState);
        }

        if (newState.toLowerCase() == "toogle".toLowerCase()) {
            TuyaStatus.toggle(callback);
        }
        if (newState.toLowerCase() == "on".toLowerCase()) {
            TuyaStatus.on(callback);
        }
        if (newState.toLowerCase() == "off".toLowerCase()) {
            TuyaStatus.off(callback);
        }
    }
}

exports.setColor = function (hexColor, callback) {
    console.log("tuya-connector.setColor");
    TuyaStatus.setColor(hexColor, callback);
}

exports.getCurrent = function () {
    TuyaStatus.getCurrent();
}

exports.getStatus = function (callback) {
    TuyaStatus.get(function (status) {
        if (_DEBUG) {
            console.log("get current status: " + status);
        }
        if (callback != undefined) {
            callback.call(this, status);
        }
    });
}