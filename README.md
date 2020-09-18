# tuyAPI-MQTT Client
MQTT interface for Tuya home automation devices sold under various names.
This is a wrapper script for the Project codetheweb/tuyapi. https://github.com/codetheweb/tuyapi

This project provides an MQTT gateway for locally controlling home automation devices made by Tuya Inc.  To use this script you will need to obtain the device ID and local keys for each of your devices after they are configured via the Tuya/Smart Life or other Tuya compatible app (there are many).  With this information it is possible to communicate locally with Tuya devices using protocol 3.1 and 3.3, without using the Tuya Cloud service, however, getting the keys requires signing up for a Tuya IOT developer account or using one of several other alternative methods (such as dumping the memory of a Tuya based app running on Andriod).  Acquiring keys is not part of this project, please see the instructions at the TuyAPI project (on which this script is based) available at the TuyAPI project site:

https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md.

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
**It's possible to replace the device IP address \<tuyAPI-ip\> with the word "discover" to have the API attempt to automatically discover the device IP address.  This allows support for 3.3 protocol devices transparently, without additional configuraiton, but does require the system running this script to be on the same IP subnet as the Tuya device since the discovery protocol relies on UDP broadcast packets from the devices.**
```
    tuya/<tuyAPI-id>/<tuyAPI-key>/discover/state
    tuya/<tuyAPI-id>/<tuyAPI-key>/discover/command
```
**If discovery will not work for your case you can still use the IP address, but, to use protocol 3.3 you must specify it in the topic explicitly**
```
    tuya/ver3.3/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip/state
    tuya/ver3.3/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command
```
Example command topic to set the device state:
```
    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command

    Example MQTT message payload for basic command (assumes DPS 1 is "on/off" control):
    "ON" 
    "OFF"
    "on"
    "off"
    "1"
    "0"
    "toggle"
    "TOGGLE"

    Example MQTT message payload for advanced commands (set any DPS value):
    "{ \"dps\": 1, \"set\": true }"
    "{ \"dps\": 7, \"set\": true }"
    "{ \"multiple\": true, \"data\": { \"1\": true, \"7\": true } }"
    "{ \"schema\": true }"
    "{ \"multiple\": true, \"data\": { \"1\": true, \"2\": \"scene_4\" } }"
    "{ \"multiple\": true, \"data\": { \"1\": true, \"2\": \"scene\", \"6\": \"c479000025ffc3\" } }"

Command topic for color change of lightbulb
    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/color

    Example MQTT message payload:
    64,0,100
    0,0,89
```

### MQTT State Topic's (get device data)
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
