# tuya-mqtt
This project provides an MQTT gateway for locally controlling home automation devices made by Tuya Inc and sold under many different brands.  To use this script you will need to obtain the device ID and local keys for each of your devices after they are configured via the Tuya/Smart Life or other Tuya compatible app (there are many).  With this information it is possible to communicate locally with Tuya devices using Tuya protocol version 3.1 and 3.3, without using the Tuya Cloud service, however, getting the keys requires signing up for a Tuya IOT developer account or using one of several other alternative methods (such as dumping the memory of a Tuya based app running on Andriod).

Acquiring keys is not part of this project, please see the instructions at the TuyAPI project (on which this script is based) available at the TuyAPI project site:

https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md.

**!!!!!!!!!! Important information regarding the 3.0 release !!!!!!!!!!**
The 3.0.0 release (Oct 17th, 2020) is a major refactor of the tuya-mqtt project and, as such, is a breaking release.  Almost everything about the project is different, including configuration, topic names, etc.  Upgrading users should carefully read the instructions below and assume they are starting over from scratch.

## Instructions:
Download this project to your system into any directory (example below uses /opt/tuya-mqtt) and install tuyapi from the same folder that the tuya-mqtt.js is in
```
// switch to opt directory
cd /opt

// clone this project
git clone https://github.com/TheAgentK/tuya-mqtt

// change directory to the project directory
cd tuya-mqtt

//installs this project along with codetheweb/tuyapi project
npm install
```

## Configuration
tuya-mqtt uses two different configuration files, config.json is a simple file which contains settings for connection to the MQTT broken, and devices.conf is a JSON5 file which defines the Tuya device that the script should connect to and expose via MQTT.  This file uses the same basic format as the "tuya-cli wizard" outputs when used to acquire the device keys, so it can be used as the basis for you configuration.

### Seting up config.json:
```
cp config.json.sample config.json

// Edit config.json with your MQTT broker settings and save
nano config.json 
```

## Setup devices.conf:
If you use the "tuya-cli wizard" method to acquire your device keys you can leverage the output of this tool as the start of your devices.conf file.  Otherwise, you want to create a file using a formate like this:
```
[
  {
    name: 'Tuya Device 1',
    id: '86435357d8b123456789',
    key: '8b2a69c9876543210'
  },
  {
    name: 'Tuya Device 2',
    id: 'eb532eea7d12345678abc',
    key: '899810012345678'
  }
]

Note that, because the format is JSON5, which is a superset of JSON, you can use standard, strict JSON syntax, or the more forgiving JSON5 format, or even mix and match in the same file.

While the above syntax is enough to create a working tuya-mqtt install with generic devices, the full power and simplicity of tuya-mqtt 3.0 is only unlocked by configuring device types to get .  Please see the full [DEVICES](docs/DEVICES.md) documenation for details.

### Start command
```
node tuya-mqtt.js

// For debugging purpose, to use DEBUG : https://www.npmjs.com/package/debug

//on Linux machines at the bash command prompt, to turn ON DEBUG:
DEBUG=tuya-mqtt:* tuya-mqtt.js

// on Windows machines at the cmd.exe command prompt, to turn ON DEBUG:
Set DEBUG=tuya-mqtt:* & node c:/openhab2/userdata/etc/scripts/tuya-mqtt.js
```

### Tuya DPS values Overview
Tuya devices are monitored and controlled using a simple API where a devices functions are mapped to DPS (data point state) values stored in various numbered keys.  For example, a simple on/off switch may have a single key, DPS1, with a setting of true/false representing the on/off state of the device.  The device state can be read via this DPS1 key, and, for values that can be changed, sending true/false to DPS 1 will turn the device on/off.  A simple dimmer might have the same DPS1 key as true/false for on/off, and a DPS2 key as a value from 0-255 to represent the state of the dimmer value.  More complex devices use more DPS keys with various values representing the states and control functions of the device.

### MQTT Topic Overview
The top level topics are created using the device name or ID as the primary identifier.  If the device name is available, it will be converted to lowercase and spaced replace with underscores('_') characters so, for example, if using the sample devices.conf file from above, the top level topic would be:
```
tuya/tuya_device_1/
```
If the device name was not available, it would instead use the device ID:
```
tuya/86435357d8b123456789/
```
All other topics are then build below this level.

tuya-mqtt directly exposes the Tuya DPS keys and values via MQTT topics and you can control any Tuya device using these topics, however, because it is not always easy to translate the Tuya values into something easy to consume by standard Home Automation systems, tuya-mqtt includes a simple templating engine to map DPS values to "friendly topics", i.e. topics that are easier to consume.

By default, all devices are treated as generic Tuya devices and only the raw DPS values are exposed, however, some devices have predefined templates which can be configured in the device.conf file.  Also, you can manually define a template mapping using the "GenericDevice" configuraiton.  Please read more details in the [DEVICES](docs/DEVICES.md) documentation.

For more details on DPS and friendly topics, please see the [TOPICS](TOPICS.md) documentation.

## Issues
Not all Tuya protocols are supported.  For example, some devices use protocol 3.2 which currently remains unsupported by the TuyAPI project due to lack of enough information to reverse engineer the protcol.  If you are unable to control your devices with tuya-mqtt please verify that you can query and control them with tuya-cli first.  If tuya-cli works, then this script should also work, if it doesn't then this script will not work either.

## Integration with other Home Automation tools
openHAB examples are [here](docs/openHAB.md).

## Contributors
- [TheAgentK](https://github.com/TheAgentK)
- [tsightler](https://github.com/tsightler)
- [Tycale](https://github.com/Tycale)
- [crashdummymch](https://github.com/crashdummymch)
- [GadgetAngel](https://github.com/GadgetAngel)


## Related Projects:
- https://github.com/codetheweb/tuyapi
- https://github.com/unparagoned/njsTuya
- https://github.com/clach04/python-tuya
- https://github.com/Marcus-L/m4rcus.TuyaCore
- Specs: https://docs.tuya.com/en/cloudapi/cloud_access.html

[![forthebadge](https://forthebadge.com/images/badges/made-with-javascript.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)
