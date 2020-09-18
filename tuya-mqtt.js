'use strict'
const mqtt = require('mqtt');
const TuyaDevice = require('./tuya-device');
const debug = require('debug')('TuyAPI:mqtt');
const debugColor = require('debug')('TuyAPI:mqtt:color');
const debugTuya = require('debug')('TuyAPI:mqtt:device');
const debugError = require('debug')('TuyAPI:mqtt:error');
var cleanup = require('./cleanup').Cleanup(onExit);

var CONFIG = undefined;
var mqtt_client = undefined;

function bmap(istate) {
    return istate ? 'ON' : "OFF";
}

function boolToString(istate) {
    return istate ? 'true' : "false";
}

/*
 * execute function on topic message
 */

function IsJsonString(text) {
    if (/^[\],:{}\s]*$/.test(text.replace(/\\["\\\/bfnrtu]/g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
        //the json is ok
        return true;
    }
    return false;
}

/**
 * check mqtt-topic string for old notation with included device type
 * @param {String} topic
 */
function checkTopicNotation(_topic) {
    var topic = _topic.split("/");
    var type = topic[1];
    var result = (type == "socket" || type == "lightbulb" || type == "ver3.1" || type == "ver3.3");
    return result;
}

/**
 * get action from mqtt-topic string
 * @param {String} topic
 * @returns {String} action type
 */
function getActionFromTopic(_topic) {
    var topic = _topic.split("/");

    if (checkTopicNotation(_topic)) {
        return topic[5];
    } else {
        return topic[4];
    }
}

/**
 * get device informations from mqtt-topic string
 * @param {String} topic
 * @returns {String} object.id
 * @returns {String} object.key
 * @returns {String} object.ip
 */
function getDeviceFromTopic(_topic) {
    var topic = _topic.split("/");

    if (checkTopicNotation(_topic)) {
        // When there are 5 topic levels
        // topic 2 is id, and topic 3 is  key
        var options = {
            id: topic[2],
            key: topic[3]
        };

        // 4th topic is IP address or "discover" keyword
        if (topic[4] !== "discover") {
            options.ip = topic[4]
            // If IP is manually specified check if topic 1
            // is protocol version and set accordingly
			if (topic[1] == "ver3.3") {
				options.version = "3.3"
			} else if (topic[1] == "ver3.1") {
				options.version = "3.1"
			} else {
                // If topic is not version then it's device type
                // Not used anymore but still supported for legacy setups
				options.type = topic[1]
			};
        };

        return options;
    } else {
        // When there are 4 topic levels
        // topic 1 is id, topic 2 is key
		var options = {
			id: topic[1],
			key: topic[2]
		};

        // If topic 3 is not discover assume it is IP address
        // Todo: Validate it is an IP address
		if (topic[3] !== "discover") {
			options.ip = topic[3]
		};

        return options;
    }
}

/**
 * get command from mqtt - topic string
 * converts simple commands to TuyAPI JSON commands
 * @param {String} topic
 * @returns {Object}
 */
function getCommandFromTopic(_topic, _message) {
    var topic = _topic.split("/");
    var command = null;

    if (checkTopicNotation(_topic)) {
        command = topic[6];
    } else {
        command = topic[5];
    }

    if (command == null) {
        command = _message;
    }

    if (command != "1" && command != "0" && IsJsonString(command)) {
        debug("command is JSON");
        command = JSON.parse(command);
    } else {
        if (command.toLowerCase() != "toggle") {
            // convert simple commands (on, off, 1, 0) to TuyAPI-Commands
            var convertString = command.toLowerCase() == "on" || command == "1" || command == 1 ? true : false;
            command = {
                set: convertString
            }
        } else {
            command = command.toLowerCase();
        }
    }

    return command;
}

mqtt_client.on('message', function (topic, message) {
    try {
        message = message.toString();
        var action = getActionFromTopic(topic);
        var options = getDeviceFromTopic(topic);

        debug("receive settings", JSON.stringify({
            topic: topic,
            action: action,
            message: message,
            options: options
        }));

        var device = new TuyaDevice(options);
        device.then(function (params) {
            var device = params.device;

            switch (action) {
                case "command":
                    var command = getCommandFromTopic(topic, message);
                    debug("receive command", command);
                    if (command == "toggle") {
                        device.switch(command).then((data) => {
                            debug("set device status completed", data);
                        });
                    }
                    if (command.schema === true) {
                        // this command is very useful. IT IS A COMMAND. It's place under the command topic.
                        // It's the ONLY command that does not use device.set to get a result.
                        // You have to use device.get and send the get method an exact JSON string of { schema: true }
                        // This schema command does NOT
                        // change the state of the device, all it does is query the device
                        // as a confirmation that all communications are working properly.
                        // Otherwise you have to physically change the state of the device just to
                        // find out if you can talk to it.  If this command returns no errors than
                        // we know we are have an established communication channel.  This is a native TuyAPI call that
                        // the TuyAPI interface defines (its only available via the GET command.
                        // this call returns a object of results
                        device.schema(command).then((data) => {
                        });
                        debug("get (schema) device status completed");
                    } else {
                        device.set(command).then((data) => {
                            debug("set device status completed", data);
                        });
                    }
                    break;
                case "color":
                    var color = message.toLowerCase();
                    debugColor("set color: ", color);
                    device.setColor(color).then((data) => {
                        debug("set device color completed", data);
                    });
                    break;
            }

        }).catch((err) => {
            debugError(err);
        });
    } catch (e) {
        debugError(e);
    }
});

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

            if (typeof tuyaIP == "undefined") {
                tuyaIP = "discover"
            }

            if (typeof tuyaID != "undefined" && typeof tuyaKey != "undefined") {
                var topic = CONFIG.topic;
                if (typeof type != "undefined") {
                    topic += type + "/";
                }
                topic += tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/state";

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

            if (typeof tuyaIP == "undefined") {
                tuyaIP = "discover"
            }

            if (typeof tuyaID != "undefined" && typeof tuyaKey != "undefined") {
                var baseTopic = CONFIG.topic;
                if (typeof type != "undefined") {
                    baseTopic += type + "/";
                }
                baseTopic += tuyaID + "/" + tuyaKey + "/" + tuyaIP + "/dps";

                var topic = baseTopic;
                var data = JSON.stringify(dps);
                debugTuya("mqtt dps updated to:" + topic + " -> ", data);
                mqtt_client.publish(topic, data, {
                    retain: CONFIG.retain,
                    qos: CONFIG.qos
                });

                Object.keys(dps).forEach(function (key) {
                    var topic = baseTopic + "/" + key;
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
        if (typeof data.dps != "undefined") {
            debugTuya('Data from device ' + this.tuyID + ' :', data);
            var status = data.dps['1'];
            if (typeof status != "undefined") {
                publishStatus(this, bmap(status));
            }
            publishDPS(this, data.dps);
        }
    } catch (e) {
        debugError(e);
    }
});

/**
 * Function call on script exit
 */
function onExit() {
    TuyaDevice.disconnectAll();
};

// Simple sleep to pause in async functions
function sleep(sec) {
    return new Promise(res => setTimeout(res, sec*1000));
}

// Main code loop
const main = async() => {

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

	mqtt_client = mqtt.connect({
    	host: CONFIG.host,
    	port: CONFIG.port,
    	username: CONFIG.mqtt_user,
    	password: CONFIG.mqtt_pass,
	});

	mqtt_client.on('connect', function (err) {
    	debug("Connection established to MQTT server");
    	var topic = CONFIG.topic + '#';
    	mqtt_client.subscribe(topic, {
        	retain: CONFIG.retain,
        	qos: CONFIG.qos
    	});
	});

	mqtt_client.on("reconnect", function (error) {
    	if (mqtt_client.connected) {
        	debug("Connection to MQTT server lost. Attempting to reconnect...");
    	} else {
        	debug("Unable to connect to MQTT server");
    	}
	});

	mqtt_client.on("error", function (error) {
    	debug("Unable to connect to MQTT server", error);
	});

	mqtt_client.on('message', function (topic, message) {
    	try {
        	message = message.toString();
        	var action = getActionFromTopic(topic);
        	var options = getDeviceFromTopic(topic);

        	debug("receive settings", JSON.stringify({
            	topic: topic,
            	action: action,
            	message: message,
            	options: options
        	}));

        	var device = new TuyaDevice(options);

        	device.then(function (params) {
            	var device = params.device;

            	switch (action) {
                	case "command":
                    	var command = getCommandFromTopic(topic, message);
                    	debug("receive command", command);
                    	if (command == "toggle") {
                        	device.switch(command).then((data) => {
                            	debug("set device status completed", data);
                        	});
                    	} else {
                        	device.set(command).then((data) => {
                            	debug("set device status completed", data);
                        	});
                    	}
                    	break;
                	case "color":
                    	var color = message.toLowerCase();
                    	debugColor("set color: ", color);
                    	device.setColor(color).then((data) => {
                        	debug("set device color completed", data);
                    	});
                    	break;
            	}

        	}).catch((err) => {
            	debugError(err);
        	});
    	} catch (e) {
        	debugError(e);
    	}
	});

}

// Call the main code
main()

/**
 * Function call on script exit
 */
function onExit() {
    TuyaDevice.disconnectAll();
    if (tester) tester.destroy();
};