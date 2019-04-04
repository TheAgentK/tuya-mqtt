const mqtt = require('mqtt');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('tuya-mqtt');
const debugColor = require('debug')('color');
const debugMqtt = require('debug')('mqtt');
const debugTuya = require('debug')('tuyAPI-Events');
const debugError = require('debug')('error');
var domain = require('domain');
var domain2 = domain.create();
// catch the uncaught errors that weren't wrapped in a domain or try catch statement
// do not use this in modules, but only in applications, as otherwise we could have multiple of these bound
process.on('uncaughtException', err2 => {
    debug(" The uncaughtException Listener caught the Error, the Error Message is ("+err2.message+").");
});
// if you can't get rid of the error or figure out why it only occurs on initial startup then you should handle
// it so it does not show up in the event log in openhab2.  I also noticed that the error occurs when switching to
// talk to a new device.  Once you have talked to a device as long as the server runs without a reboot, the Error
// of not connection made disappears. But, if the system reboots, the user should be made aware that on restart of
// openhab2 they should try to do two state topics to each device twice so that when they want to contorl the deice
// commands will go through.
process.on('unhandledRejection', err3 => {
    debug("========**********unhandledRejection listener caught the Error, the Error Message is: ", err3.message);
});

// Sometimes though, there may still be code that throws an error somewhere which
// can lead to an uncaught exception and a potential crash of our application if we
// don't catch it safely. When we know where the error is occurring, we can wrap
// that section in a node.js domain
domain2.on('error', function(err){
    // handle the error safely
    debug("Domain2 handled this error, error line number: the Error message is ("+err.message+").");
});
domain2.run(function() {

    var cleanup = require('./cleanup').Cleanup(onExit);


    function bmap(istate) {
        return istate ? 'ON' : "OFF";
    }

    var connected = undefined;
    var CONFIG = undefined;

    try {
        CONFIG = require("./config");
    } catch (e) {
        console.error("Configuration file not found")
        debugError(e)
        process.exit(1)
    }

    if (typeof CONFIG.qos == "undefined") {
        CONFIG.qos = 2;
    }
    if (typeof CONFIG.retain == "undefined") {
        CONFIG.retain = false;
    }

    const mqtt_client = mqtt.connect({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.mqtt_user,
        password: CONFIG.mqtt_pass,
    });

    mqtt_client.on('connect', function (err) {
        debugMqtt("\"Connection established with MQTT server");
        connected = true;
        var topic = CONFIG.topic + '#';
        mqtt_client.subscribe(topic, {
            retain: CONFIG.retain,
            qos: CONFIG.qos
        });
    });

    mqtt_client.on("reconnect", function (error) {
        if (connected) {
            debugMqtt("Connection with MQTT server was interrupted. Renewed connection attempt!");
        } else {
            debugMqtt("Unable to connect to MQTT server.");
        }
        connected = false;
    });

    mqtt_client.on("error", function (error) {
        debugMqtt("Unable to connect to MQTT server", error);
        connected = false;
    });

    /**
     * execute function on topic message
     */
    function boolToString(istate) {
        return istate == 1 ? 'on' : "off";
    }

    function convertMessage(message) {
        var status = message.toString();
        status = boolToString(status);
        status = status.toLowerCase();
        return status;
    }

    mqtt_client.on('message', function (topic, message) {
        try {
            var cMessage = convertMessage(message);
            var topic = topic.split("/");
            var options = {
                type: topic[1],
                id: topic[2],
                key: topic[3],
                ip: topic[4],
            };
            var exec = topic[5];

            if (options.type == "socket" || options.type == "lightbulb") {
                debug("device, options", options);
                if (exec == "command") {
                    if (topic[6] == null) {
                        if (message.toString().includes("{") ||
                            message.toString().toLowerCase().includes("on") ||
                            message.toString().toLowerCase().includes("off")) cMessage = message.toString();
                        debug("message", cMessage);
                    } else {
                        if (!(topic[6].includes("{") || topic[6].toLowerCase().includes("on") ||
                            topic[6].toLowerCase().includes("off"))) {
                            topic[6] = (topic[6] == 1) ? "on" : "off";
                        }
                        debug("message", topic[6].toString());
                    }
                }

                var device = new TuyaDevice(options);
                debug("device: ", device);

                if (exec == "command") {
                    var status = topic[6];
                    if (status == null) {
                        if (message.toString().includes("{") ||
                            message.toString().toLowerCase().includes("on") ||
                            message.toString().toLowerCase().includes("off")) cMessage = message.toString();
                        device.switch(cMessage);
                    } else {
                        if (!(status.includes("{") || status.toLowerCase().includes("on") ||
                            status.toLowerCase().includes("off"))) {
                            status = (status == 1) ? "on" : "off";
                        }
                        device.switch(status);
                    }
                }
                if (exec == "color") {
                    var color = message.toString();
                    color = color.toLowerCase();
                    debugColor("topic: ", topic);
                    debugColor("onColor: ", color);
                    device.setColor(color);
                }

            }
        } catch (e) {
            debug("Error occurred while in mqtt_client.on message event", e);
            debugError(e);
        }
    });

//
    /**
     * Publish current TuyaDevice state to MQTT-Topic
     * @param {TuyaDevice} device
     * @param {boolean} status
     */
    function publishStatus(device, status) {
        if (mqtt_client.connected == true) {
            try {
                var type = device.type;
                var tuyaID = device.options.id;
                var tuyaKey = device.options.key;
                var tuyaIP = device.options.ip;

                if (typeof tuyaID != "undefined" && typeof tuyaKey != "undefined" && typeof tuyaIP != "undefined") {
                    var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";
                    mqtt_client.publish(topic, status, {
                        retain: CONFIG.retain,
                        qos: CONFIG.qos
                    });
                    debugTuya("mqtt status updated to:" + topic + " -> " + status);
                } else {
                    debugTuya("mqtt status not updated");
                }
            } catch (e) {
                debugError(e);
            }
        }
    }

    function publishColorState(device, state) {

    }

    /**
     * publish all dps-values to topic
     * @param  {TuyaDevice} device
     * @param  {Object} dps
     */
    function publishDPS(device, dps) {
        if (mqtt_client.connected == true) {
            try {
                var type = device.type;
                var tuyaID = device.options.id;
                var tuyaKey = device.options.key;
                var tuyaIP = device.options.ip;

                if (typeof tuyaID != "undefined" && typeof tuyaKey != "undefined" && typeof tuyaIP != "undefined") {
                    var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/dps";
                    var data = JSON.stringify(dps);
                    debugTuya("mqtt dps updated to:" + topic + " -> ", data);
                    mqtt_client.publish(topic, data, {
                        retain: CONFIG.retain,
                        qos: CONFIG.qos
                    });

                    Object.keys(dps).forEach(function (key) {
                        var topic = CONFIG.topic + type + "/" + tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/dps/" + key;
                        var data = JSON.stringify(dps[key]);
                        debugTuya("mqtt dps updated to:" + topic + " -> dps[" + key + "]", data);
                        mqtt_client.publish(topic, data, {
                            retain: CONFIG.retain,
                            qos: CONFIG.qos
                        });
                    });
                } else {
                    debugTuya("mqtt dps not updated");
                }
            } catch (e) {
                debugError(e);
            }
        }
    }

    /**
     * event fires if TuyaDevice sends data
     * @see TuyAPI (https://github.com/codetheweb/tuyapi)
     */
    TuyaDevice.onAll('data', function (data) {
        try {
            debugTuya('Data from device ' + this.type + ' :', data);
            var status = data.dps['1'];
            if (typeof status != "undefined") {
                publishStatus(this, bmap(status));
            }
            publishDPS(this, data.dps);
        } catch (e) {
            debugError(e);
        }
    });

    /**
     * MQTT connection tester
     */
    function MQTT_Tester() {
        this.interval = null;

        function mqttConnectionTest() {
            if (mqtt_client.connected != connected) {
                connected = mqtt_client.connected;
                if (connected) {
                    debugMqtt('MQTT-Server connected.');
                } else {
                    debugMqtt('MQTT-Server not connected.');
                }
            }
        }

        this.destroy = function () {
            clearInterval(this.interval);
            this.interval = undefined;
        };

        this.connect = function () {
            this.interval = setInterval(mqttConnectionTest, 1500);
            mqttConnectionTest();
        };

        var constructor = (function (that) {
            that.connect.call(that);
        })(this);
    }

    var tester = new MQTT_Tester();

    /**
     * Function call on script exit
     */
    function onExit() {
        TuyaDevice.disconnectAll();
        if (tester) tester.destroy();
    }
});
