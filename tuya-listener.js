const dgram = require('dgram');
const server = dgram.createSocket('udp4');

var devices = [];

function deviceContains(search) {
    var found = false;
    for (var i = 0; i < devices.length; i++) {
        if (devices[i].ip == search.ip) {
            found = true;
            break;
        }
    }
    return found;
}

exports.getDeviceList = function () {
    devices.forEach(function (entry) {
        console.log(entry.ip);
    });
}

exports.addDevice = function (device) {
    if (!deviceContains(device)) {
        devices.push(device);
    }
}

exports.parseMsg = function (msg) {
    var str = msg.toString();
    var fistBrecket = str.indexOf("{");
    var lastBrecket = str.indexOf("}");
    var jsonStr = str.substring(fistBrecket, (lastBrecket + 1));
    return JSON.parse(jsonStr);
}

server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});

server.on('message', (msg, rinfo) => {
    try {
        var json = module.exports.parseMsg(msg);
        module.exports.addDevice(json);
        console.log(module.exports.getDeviceList());
    } catch (e) {
        // Anweisungen für jeden Fehler
        console.log(e); // Fehler-Objekt an die Error-Funktion geben
    }
});

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(6666);