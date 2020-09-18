# tuyAPI-MQTT Client
MQTT interface for Tuya home automation devices sold under various names.
This is a wrapper script for the Project codetheweb/tuyapi. https://github.com/codetheweb/tuyapi

This project provides an MQTT gateway for locally controlling home automation devices made by Tuya Inc.  To use this script you will need to obtain the device ID and local keys for each of your devices after they are configured via the Tuya/Smart Life or other Tuya compatible app (there are many).  With this information it is possible to communicate locally with Tuya devices using protocol 3.1 and 3.3, without using the Tuya Cloud service, however, getting the keys requires signing up for a Tuya IOT developer account or using one of several other alternative methods (such as dumping the memory of a Tuya based app running on Andriod).  Acquiring keys is not part of this project, please see the instructions at the TuyAPI project (on which this script is based) available at https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md.

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

This  found here: https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md


## Basic Usage

### Create your configuration file:
```
cp config.json.sample config.json

// edit the configuration file
nano config.json 
```

### Start command
```
node tuya-mqtt.js

// For debugging purpose, to use DEBUG : https://www.npmjs.com/package/debug

//on Linux machines at the bash command prompt, to turn ON DEBUG:
DEBUG=* tuya-mqtt.js

//on Linux machines at the bash command prompt, to turn OFF DEBUG:
DEBUG=-* tuya-mqtt.js

// on Windows machines at the cmd.exe command prompt, to turn ON DEBUG:
Set DEBUG=* & node c:/openhab2/userdata/etc/scripts/tuya-mqtt.js

// on Windows machines at the cmd.exe command prompt, to turn OFF DEBUG:
Set DEBUG=-* & node c:/openhab2/userdata/etc/scripts/tuya-mqtt.js
```

### MQTT Topic's (send data)
**-----IMPORTANT NOTE-----**
**It's possible to replace the device IP address \<tuyAPI-ip\> with the word "discover" to have the API attempt to automatically discover the device IP address.  This capability allows support for 3.3 protocol devices without additional configuraiton but does require the system running this script to be on the same IP subnet as the Tuya device because discover relies on UDP broadcast from the devices.**
```
    tuya/<tuyAPI-id>/<tuyAPI-key>/discover/state
    tuya/<tuyAPI-id>/<tuyAPI-key>/discover/command
```
If discovery will not work for your case you can still use the IP address, but, to use protocol 3.3 you must specify it in the topic explicitly
```
    tuya/ver3.3/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip/state
    tuya/ver3.3/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command
```
Change device state (by topic):
    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/<STATE>

    Example:
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/on
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/off
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/ON
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/OFF
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/1
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/0
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/toggle
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/TOGGLE
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/{ "dps": 1, "set": true }
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/{ "dps": 7, "set": true }
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/{ "multiple": true, "data": { "1": true, "7": true } }
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/{ "schema": true }
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/{ "multiple": true, "data": { "1": true, "2": "scene_4" } }
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/{ "multiple": true, "data": 
                                                              { "1": true, "2": "scene", "6": "c479000025ffc3" } } 

Change device state (by payload)
Use with OpenHAB 2.X MQTT bindings or others where only a single command topic is preferred:
NOTE: notice that nothing follows the word command, DO NOT but a "/" in after command.

    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command

    Example:
    "ON"
    "OFF"
    "on"
    "off"
    "1"
    "0"
    "toggle"
    "TOGGLE"
    "{ \"dps\": 1, \"set\": true }"
    "{ \"dps\": 7, \"set\": true }"
    "{ \"multiple\": true, \"data\": { \"1\": true, \"7\": true } }"
    "{ \"schema\": true }"
    "{ \"multiple\": true, \"data\": { \"1\": true, \"2\": \"scene_4\" } }"
    "{ \"multiple\": true, \"data\": { \"1\": true, \"2\": \"scene\", \"6\": \"c479000025ffc3\" } }"

Change color of lightbulb (payload as HSB-Color)
    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/color

    Example:
    64,0,100
    0,0,89
```

### MQTT Topic's (read data)
```
Current device state (allways DPS[1]-Value):
    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/state

Device DPS-Values:
    // returns JSON.stringify(dps) values, use with care, does not always contain all dps values
    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/dps

    // return single dps data value
    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/dps/<tuya-dps-id>
```

## Issues
Not all Tuya protocols are supported.  For example, some devices use protocol 3.2 which currently remains unsupported by the TuyAPI project due to lack of enough information to reverse engineer the protcol.  If you are unable to control your devices with tuya-mqtt please verify that you can query and control them with tuya-cli first.  If tuya-cli works, then this script should also work, if it doesn't then this script will not work either.

## Integration with other tools
openHAB examples are (here)[docs/openHAB.md].

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
