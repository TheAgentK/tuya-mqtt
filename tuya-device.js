const TuyAPI = require('tuyapi');
const TuyColor = require('./tuya-color');
const debug = require('debug')('TuyAPI:device');
const debugError = require('debug')('TuyAPI:device:error');
const debugColor = require('debug')('TuyAPI:device:color');

/**
 *
    var steckdose = new TuyaDevice({
        id: '03200240600194781244',
        key: 'b8bdebab418f5b55',
        ip: '192.168.178.45',
        type: "ver33" 
    });
 */

var TuyaDevice = (function () {
    var devices = [];
    var events = {};

    function checkExisiting(id) {
        var existing = false;
        // Check for existing instance
        devices.forEach(device => {
            if (device.hasOwnProperty("options")) {
                if (id === device.options.id) {
                    existing = device;
                }
            }
        });
        return existing;
    }

    function deleteDevice(id) {
        devices.forEach((device, key) => {
            if (device.hasOwnProperty("options")) {
                if (id === device.options.id) {
                    debug("delete Device", devices[key].toString());
                    delete devices[key];
                }
            }
        });
    }

    function TuyaDevice(options, callback) {
        var device = this;
        // Check for existing instance
        if (existing = checkExisiting(options.id)) {
            return new Promise((resolve, reject) => {
                resolve({
                    status: "connected",
                    device: existing
                });
            });
        }

        if (!(this instanceof TuyaDevice)) {
            return new TuyaDevice(options);
        }

        options.type = options.type || undefined;

        this.type = options.type;
        this.options = options;

        Object.defineProperty(this, 'device', {
            value: new TuyAPI(JSON.parse(JSON.stringify(this.options)))
        });

        this.device.on('data', data => {
            if (typeof data == "string") {
                debugError('Data from device not encrypted:', data.replace(/[^a-zA-Z0-9 ]/g, ""));
            } else {
                debug('Data from device:', data);
                device.triggerAll('data', data);
            }
        });

        devices.push(this);
        // Find device on network
        debug("Search device in network");
        this.find().then(() => {
            debug("Device found in network");
            // Connect to device
            this.device.connect();
        });

        /**
         * @return promis to wait for connection
         */
        return new Promise((resolve, reject) => {
            this.device.on('connected', () => {
                device.triggerAll('connected');
                device.connected = true;
                debug('Connected to device.', device.toString());
                resolve({
                    status: "connected",
                    device: this
                });
            });
            this.device.on('disconnected', () => {
                device.triggerAll('disconnected');
                device.connected = false;
                debug('Disconnected from device.', device.toString());
                deleteDevice(options.id);
                return reject({
                    status: "disconnect",
                    device: null
                });
            });

            this.device.on('error', (err) => {
                debugError(err);
                device.triggerAll('error', err);
                return reject({
                    error: err,
                    device: this
                });
            });
        });
    }

    TuyaDevice.prototype.toString = function () {
        if (typeof this.type != "undefined") {
            return this.type + " (" + this.options.ip + ", " + this.options.id + ", " + this.options.key + ")";
        } else {
            return " (" + this.options.ip + ", " + this.options.id + ", " + this.options.key + ")";
        }
    }

    TuyaDevice.prototype.triggerAll = function (name, argument) {
        var device = this;
        var e = events[name] || [];
        e.forEach(event => {
            event.call(device, argument);
        });
    }

    TuyaDevice.prototype.on = function (name, callback) {
        if (!this.connected) return;
        var device = this;
        this.device.on(name, function () {
            callback.apply(device, arguments);
        });
    }

    TuyaDevice.prototype.find = function () {
        return this.device.find();
    }

    TuyaDevice.prototype.get = function () {
        return this.device.get();
    }

    TuyaDevice.prototype.set = function (options) {
        debug('set:', options);
        return new Promise((resolve, reject) => {
            this.device.set(options).then((result) => {
                this.get().then(() => {
                    debug("set completed ");
                    resolve(result);
                });
            });
        });
    }

    TuyaDevice.prototype.switch = function (newStatus, callback) {
        if (!this.connected) return;
        newStatus = newStatus.toLowerCase();
        if (newStatus == "on") {
            return this.switchOn(callback);
        }
        if (newStatus == "off") {
            return this.switchOff(callback);
        }
        if (newStatus == "toggle") {
            return this.toggle(callback);
        }
    }

    TuyaDevice.prototype.switchOn = function () {
        if (!this.connected) return;
        debug("switch -> ON");

        return this.set({
            set: true
        });
    }

    TuyaDevice.prototype.switchOff = function () {
        if (!this.connected) return;
        debug("switch -> OFF");

        return this.set({
            set: false
        });
    }

    TuyaDevice.prototype.toggle = function () {
        if (!this.connected) return;
        return new Promise((resolve, reject) => {
            this.get().then((status) => {
                debug("toogle state", status);
                this.set({
                    set: !status
                });
            });
        });
    }

    TuyaDevice.prototype.schema = function(obj){
        return this.get(obj).then((status) => {
            debug("get", obj);
        });
    }

    TuyaDevice.prototype.setColor = function (hexColor) {
        if (!this.connected) return;
        debugColor("Set color to: ", hexColor);
        var tuya = this.device;
        var color = new TuyColor(tuya);
        var dps = color.setColor(hexColor);
        debugColor("dps values:", dps);

        return this.set({
            multiple: true,
            data: dps
        });
    }

    TuyaDevice.prototype.connect = function (callback) {
        debug("Connect to TuyAPI Device");
        return this.device.connect(callback);
    }

    TuyaDevice.prototype.disconnect = function (callback) {
        debug("Disconnect from TuyAPI Device");
        return this.device.disconnect(callback);
    }

    Object.defineProperty(TuyaDevice, 'devices', {
        value: devices
    });

    TuyaDevice.connectAll = function () {
        devices.forEach(device => {
            device.connect();
        });
    }

    TuyaDevice.disconnectAll = function () {
        devices.forEach(device => {
            device.disconnect();
        });
    }

    TuyaDevice.onAll = function (name, callback) {
        if (events[name] == undefined) {
            events[name] = [];
        }
        events[name].push(callback);
        devices.forEach(device => {
            device.triggerAll(name);
        });
    }

    return TuyaDevice;
}());

module.exports = TuyaDevice;
