const TuyaDevice = require('tuyapi');
const TuyaColor = require('./tuya-color');

// Import packages
const dgram = require('dgram');
const net = require('net');
const timeout = require('p-timeout');
const retry = require('retry');
const debug = require('debug')('TuyAPI-ext');

// Helpers
const Cipher = require('tuyapi/lib/cipher');
const Parser = require('tuyapi/lib/message-parser')

TuyaDevice.prototype.getDevice = function () {
    return this.device;
}

TuyaDevice.prototype.get = function (options) {
    // Set empty object as default
    options = options ? options : {};

    const payload = {
        gwId: this.device.id,
        devId: this.device.id
    };

    debug('Payload: ', payload);

    // Create byte buffer
    const buffer = Parser.encode({
        data: payload,
        commandByte: '0a'
    });

    return new Promise((resolve, reject) => {
        this._send(this.device.ip, buffer).then(data => {
            var dps = data.dps;
            if (options.schema === true) {
                resolve(data);
            } else if (options.dps) {
                resolve(dps[options.dps]);
            } else {
                if (dps != undefined && dps["1"] != undefined) {
                    resolve(dps['1']);
                } else {
                    resolve(dps);
                }
            }
        }).catch(err => {
            reject(err);
        });
    });
};

TuyaDevice.prototype.set = function (options) {
    let dps = {};
    var count = Object.keys(options).length;

    if (options.dps != undefined || options.set != undefined) {
        if (options.dps === undefined) {
            dps = {
                1: options.set
            };
        } else {
            dps = {
                [options.dps.toString()]: options.set
            };
        }
    } else {
        dps = options;
    }

    const now = new Date();
    const timeStamp = (parseInt(now.getTime() / 1000, 10)).toString();

    const payload = {
        devId: this.device.id,
        uid: '',
        t: timeStamp,
        dps
    };

    debug('Payload:');
    debug(payload);

    // Encrypt data
    const data = this.device.cipher.encrypt({
        data: JSON.stringify(payload)
    });

    // Create MD5 signature
    const md5 = this.device.cipher.md5('data=' + data +
        '||lpv=' + this.device.version +
        '||' + this.device.key);

    // Create byte buffer from hex data
    const thisData = Buffer.from(this.device.version + md5 + data);
    const buffer = Parser.encode({
        data: thisData,
        commandByte: '07'
    });

    // Send request to change status
    return new Promise((resolve, reject) => {
        this._send(this.device.ip, buffer).then(() => {
            resolve(true);
        }).catch(err => {
            reject(err);
        });
    });
};

/**
 * Sends a query to a device.
 * @private
 * @param {String} ip IP of device
 * @param {Buffer} buffer buffer of data
 * @returns {Promise<string>} returned data
 */
TuyaDevice.prototype._sendUnwrapped = function (ip, buffer) {
    debug('Sending this data: ', buffer.toString('hex'));

    const client = new net.Socket();

    return new Promise((resolve, reject) => {
        // Attempt to connect
        client.connect(6668, ip);

        // Default connect timeout is ~1 minute,
        // 10 seconds is a more reasonable default
        // since `retry` is used.
        client.setTimeout(1000, () => {
            client.emit('error', new Error('connection timed out'));
            client.destroy();
        });

        // Send data when connected
        client.on('connect', () => {
            debug('Socket connected.');

            // Remove connect timeout
            client.setTimeout(0);

            // Transmit data
            client.write(buffer);

            this._sendTimeout = setTimeout(() => {
                client.destroy();
                reject(new Error('Timeout waiting for response'));
            }, this._responseTimeout * 1000);
        });

        // Parse response data
        client.on('data', data => {
            debug('Received data back:');
            debug(data.toString('hex'));

            clearTimeout(this._sendTimeout);
            client.destroy();

            data = Parser.parse(data);

            if (typeof data === 'object' || typeof data === 'undefined') {
            } else {
                // Message is encrypted
                data =this.device.cipher.decrypt(data);
            }
            client.destroy(); // kill client after server's response
            resolve(data);
        });

        // Handle errors
        client.on('error', err => {
            debug('Error event from socket.');
            client.destroy(); // kill client after server's response

            // eslint-disable-next-line max-len
            err.message = 'Error communicating with device. Make sure nothing else is trying to control it or connected to it.';
            reject(err);
        });
    });
};

TuyaDevice.prototype.getStatus = function (callback) {
    var tuya = this;
    tuya.get().then(status => {
        debug('Current Status: ' + status);
        callback.call(this, status);
    });
}

TuyaDevice.prototype.setStatus = function (options, callback) {
    var tuya = this;
    tuya.set(options).then(result => {
        tuya.get().then(status => {
            debug('New status: ' + status);
            if (callback != undefined) {
                callback.call(this, status);
            } else {
                debug(status);
            }
            return;
        });
    });
}

TuyaDevice.prototype.toggle = function (callback) {
    var tuya = this;
    //tuya.resolveId().then(() => {
        tuya.get().then(status => {
            tuya.setStatus({
                set: !status
            }, callback);
        });
    //});
}

TuyaDevice.prototype.onoff = function (newStatus, callback) {
    newStatus = newStatus.toLowerCase();
    debug("onoff: " + newStatus);
    if (newStatus == "on") {
        this.on(callback);
    }
    if (newStatus == "off") {
        this.off(callback);
    }
}

TuyaDevice.prototype.setColor = function (hexColor, callback) {
    debug("Set color to", hexColor);
    var tuya = this;
    var color = new TuyaColor(tuya);
    var dps = color.setColor(hexColor);

    //tuya.resolveId().then(() => {
        tuya.get().then(status => {
            tuya.setStatus(dps, callback);
        });
    //});
}

TuyaDevice.prototype.on = function (callback) {
    var tuya = this;
    //tuya.resolveId().then(() => {
        tuya.get().then(status => {
            tuya.setStatus({
                set: true
            }, callback);
        });
    //});
}

TuyaDevice.prototype.off = function (callback) {
    debug("off: ");
    var tuya = this;
    //tuya.resolveId().then(() => {
        tuya.get().then(status => {
            tuya.setStatus({
                set: false
            }, callback);
        });
    //});
}

module.exports = TuyaDevice;