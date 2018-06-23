const TuyaDevice = require('tuyapi');
let tuya = undefined;
_DEBUG = true;

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

exports.setDebug = function (debug) {
    _DEBUG = debug;
}

exports.setDevice = function (newTuya) {
    tuya = newTuya;
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

exports.set = function (newState, callback) {
    if (this.hasDevice()) {
        tuya.set({
            set: newState
        }).then(result => {
            if (_DEBUG) {
                console.log('Result of setting status to ' + newState + ': ' + result);
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
        self.set(!newStatus, callback);
    })
}

exports.on = function (callback) {
    var self = this;
    tuya.resolveId().then(() => {
        self.set(true, callback);
    });
}

exports.off = function (callback) {
    var self = this;
    tuya.resolveId().then(() => {
        self.set(false, callback);
    });
}