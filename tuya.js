/* 
 * Simple wrapper for tuyapi for use with openhab or command line
npm install codetheweb/tuyapi
node tuya.js args
arg format --ip=192.168.x.x --id=1231204564df --key=dsf456sdf TOGGLE
args can be, ON, OFF, or TOGGLE. No arguement returns state
*/

const TuyaDevice = require('./tuya-connector');
var args = require('yargs').argv;

_DEBUG = false;

var switchStatus = args._[0];
if (switchStatus != undefined) {
    switchStatus = switchStatus.toLowerCase();
}
var tuyaID = args.id;
var tuyaKey = args.key;
var tuyaIP = args.ip;
let tuya = undefined;

if (tuyaID != undefined && tuyaKey != undefined && tuyaIP != undefined) {
    try {
        TuyaDevice.setDebug(_DEBUG);
        tuya = TuyaDevice.createDevice(tuyaID, tuyaKey, tuyaIP);
        if (switchStatus == "now".toLowerCase()) {
            if (TuyaDevice.hasDevice()) {
                TuyaDevice.getCurrent();
            }
        } else {
            if (TuyaDevice.hasDevice()) {
                TuyaDevice.setStatus(switchStatus);
            }
        }
    } catch (e) {
        console.error(e);
        console.error("error");
    }
} 