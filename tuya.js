/* 
 * Simple wrapper for tuyapi for use with openhab or command line
npm install codetheweb/tuyapi
node tuya.js args
arg format --ip=192.168.x.x --id=1231204564df --key=dsf456sdf TOGGLE
args can be, ON, OFF, or TOGGLE. No arguement returns state
*/

const TuyaDevice = require('tuyapi');
const TuyaStatus = require('./tuya-status');
var args = require('yargs').argv;
var tuyaConnect = this;

_DEBUG = false;
TuyaStatus.setDebug(_DEBUG);

var switchStatus = args._[0];
switchStatus = switchStatus.toLowerCase();
var tuyaID = args.id;
var tuyaKey = args.key;
var tuyaIP = args.ip;
let tuya = undefined;

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
            return new TuyaDevice(config);
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

exports.setStatus = function (newState) {
    if (this.hasDevice()) {
        if (_DEBUG) {
            console.log('Status: ' + newState);
        }

        if (newState == "toogle".toLowerCase()) {
            TuyaStatus.toggle();
        }
        if (newState == "on".toLowerCase()) {
            TuyaStatus.on();
        }
        if (newState == "off".toLowerCase()) {
            TuyaStatus.off();
        }
    }
}

tuya = module.exports.createDevice(tuyaID, tuyaKey, tuyaIP);
TuyaStatus.setDevice(tuya);
if (switchStatus == "now".toLowerCase()) {
    if (module.exports.hasDevice()) {
        TuyaStatus.getCurrent();
    }
} else {
    if (module.exports.hasDevice()) {
        module.exports.setStatus(switchStatus);
    }
}

