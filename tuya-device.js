const TuyAPI = require('tuyapi');
const TuyColor = require('./tuya-color');
const debug = require('debug')('TuyAPI-device');
const debugColor = require('debug')('TuyAPI-device-color');
const debugTimer = require('debug')('TuyAPI-device-timer');
var domain = require('domain');
var domain1 = domain.create();
// Sometimes though, there may still be code that throws an error somewhere which
// can lead to an uncaught exception and a potential crash of our application if we
// don't catch it safely. When we know where the error is occurring, we can wrap
// that section in a node.js domain
domain1.on('error', function(err){
    // handle the error safely
    debug("Domain1 handled this error, error line number: the Error message is ("+err.message+").");
});
/**
 *
    var steckdose = new TuyaDevice({
        id: '03200240600194781244',
        key: 'b8bdebab418f5b55',
        ip: '192.168.178.45',
        type: "socket"
    });
 */
domain1.run(function() {

    var TuyaDevice = (function () {
        var devices = [];
        var events = {};

        var autoTimeout = undefined;

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

        function resetTimer() {
            debug("In resetTimer");
            return;
            debugTimer("Reset timer for auto disconnect all devices");
            clearTimeout(autoTimeout);
            autoTimeout = setTimeout(() => {
                debugTimer("Auto disconnect all devices");
                TuyaDevice.disconnectAll();
            }, 10000);
        }

        function TuyaDevice(options) {
            var device = this;
            // Check for existing instance
            if (existing = checkExisiting(options.id)) {
                return existing;
            }

            if (!(this instanceof TuyaDevice)) {
                return new TuyaDevice(options);
            }

            options.type = options.type || "socket";
            options.persistentConnection = true;
            Object.defineProperty(this, 'type', {
                value: options.type
            });

            Object.defineProperty(this, 'options', {
                value: options
            });

            Object.defineProperty(this, 'device', {
                value: new TuyAPI(this.options)
            });

            this.device.on('connected', () => {
                debug('Connected to device.');
                device.triggerAll('connected');
            });

            this.device.on('disconnected', () => {
                debug('Disconnected from device.');
                device.triggerAll('disconnected');
            });

            this.device.on('data', data => {
                debug('Data from device:', data);
                device.triggerAll('data', data);
            });

            this.device.on('error', (err) => {
                device_error = true;
                debug('Error: ' + err);
                device.triggerAll('error', err);
            });

            this.device.find().then(result => {
                //connect to the device
                this.device.connect();
            });
            devices.push(this);
            resetTimer();
        }

        TuyaDevice.prototype.triggerAll = function (name, argument) {
            var device = this;
            var e = events[name] || [];
            e.forEach(event => {
                event.call(device, argument);
            });
        }

        TuyaDevice.prototype.on = function (name, callback) {
            var device = this;
            this.device.on(name, function () {
                callback.apply(device, arguments);
            });
        }

        TuyaDevice.prototype.get = function (options) {
                resetTimer();
                return this.device.get(options);
        }

        TuyaDevice.prototype.set = function (options, callback) {
            var device = this;
                debug('Setting status:', options);
                return this.device.set(options).then(result => {
                    device.get().then(status => {
                        debug('Result of setting status to', status);
                        if (callback != undefined) {
                            callback.call(device, status);
                        }
                        return;
                    });
                });
                resetTimer();
        }

//
        TuyaDevice.prototype.switch = function (newStatus, callback) {
            newStatus = newStatus.toLowerCase();
                debug("switch: " + newStatus);
                if (newStatus == "on") {
                    this.switchOn(callback);
                }
                if (newStatus == "off") {
                    this.switchOff(callback);
                }
                if (newStatus == "toggle") {
                    this.toggle(callback);
                }
                // at this point we know the information after the command topic is a JSON string
                if (newStatus.includes("multiple") || newStatus.includes("dps") || newStatus.includes( "schema")) {
                    debug(`newStatus contains ${newStatus}  \"multiple\" or \"dps\" or \"schema\" key words`);
                    let stateObjM = JSON.parse(newStatus);
                    debug('newStatus as a JSON object, contains:', JSON.stringify(stateObjM));
                    this.get().then(status => {
                        this.set(stateObjM, callback);
                    });
                    resetTimer();
                }
        }

        TuyaDevice.prototype.switchOn = function (callback) {
            var device = this;
            debug("switch -> ON");
                device.get().then(status => {
                    device.set({
                        set: true
                    }, callback);
                });
        }

        TuyaDevice.prototype.switchOff = function (callback) {
            var device = this;
                debug("switch -> OFF");
                device.get().then(status => {
                    device.set({
                        set: false
                    }, callback);
                });
        }

        TuyaDevice.prototype.toggle = function (callback) {
            var device = this;
                device.get().then(status => {
                    device.set({
                        set: !status
                    }, callback);
                });
        }

        TuyaDevice.prototype.setColor = function (hexColor, callback) {
            debugColor("Set color to: ", hexColor);
                var device = this;
                var tuya = this.device;
                var color = new TuyColor(tuya);
                var dps = color.setColor(hexColor);
                debugColor("dps values:", dps);

                device.get().then(status => {
                    device.set({
                        multiple: true,
                        data: dps
                    }, callback);
                });
                resetTimer();
        }

        TuyaDevice.prototype.connect = function (callback) {
            this.device.connect(callback);
        }

        TuyaDevice.prototype.disconnect = function (callback) {
            this.device.disconnect(callback);
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

});
