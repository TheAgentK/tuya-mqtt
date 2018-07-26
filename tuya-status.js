const TuyaDevice = require('tuyapi');
const TuyaColor = require('./tuya-color');
let tuya = undefined;
_DEBUG = true;

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

exports.setDebug = function (debug) {
    _DEBUG = debug;
    TuyaColor.setDebug(debug);
}

exports.setDevice = function (newTuya) {
    tuya = newTuya;
    TuyaColor.setDevice(tuya);
}

exports.hasDevice = function () {
    var device = (tuya != undefined);
    if (!device) {
        console.error("TuyaStatus - Device not set");
    }
    return device;
}

exports.get = function (callback) {
    if (this.hasDevice()) {
        tuya.resolveId().then(() => {
            tuya.get().then(status => {
                if (_DEBUG) {
                    console.log('Current Status: ' + status);
                }
                callback.call(this, status);
            });
        });
    }
}

exports.set = function (options, callback) {
    if (this.hasDevice()) {
        tuya.set(options).then(result => {
            if (_DEBUG) {
                console.log('Result of setting status to ' + options + ': ' + result);
            }
            tuya.get().then(status => {
                if (_DEBUG) {
                    console.log('New status: ' + status);
                }
                if (callback != undefined) {
                    callback.call(this, bmap(status));
                } else {
                    console.log(bmap(status));
                }
                return;
            });
        });
    }
}

exports.getCurrent = function () {
    var self = this;
    self.get(function (status) {
        console.log(bmap(status));
    });
}

exports.toggle = function (callback) {
    var self = this;
    self.get(function (newStatus) {
        self.set({
            set: !newState
        }, callback);
    })
}

exports.setColor = function (hexColor, callback) {
    var color = new TuyaColor.color();
    color.setColor(hexColor);
}

exports.on = function (callback) {
    var self = this;
    tuya.resolveId().then(() => {
        self.set({
            set: true
        }, callback);
    });
}

exports.off = function (callback) {
    var self = this;
    tuya.resolveId().then(() => {
        self.set({
            set: false
        }, callback);
    });
}