# TuyaAPI-MQTT Client
MQTT interface for Tuya home automation devices sold under various names.
This is a wrapper script for the Project codetheweb/tuyapi. https://github.com/codetheweb/tuyapi

This project provides an MQTT client for communication with the home automation devices.

## Instructions:

Download this project to your openhab2-script-folder "/etc/openhab2/scripts" and install tuyapi from the same folder that the tuya-mqtt.js is in
```
cd /etc/openhab2/scripts
git clone git@github.com:TheAgentK/tuyaapi_mqtt.git // this project
cd tuyaapi_mqtt
npm install //downloads codetheweb/tuyapi
```

Ignore all Warnings.

This involves MIM of the connection. Instructions can be found here: https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md

Start command
```
node tuya-mqtt.js

// For debugging purpose
DEBUG=* tuya-mqtt.js
```

MQTT Topic
```
Current device state:
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/state

Change device state:
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/<STATE>

    Example:
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/on
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/off

Color for lightbulb

    Example:
    tuya/lightbulb/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/color // Color as Payload as hexColor
```

#### Issues
There are some reliability issues with tuyapi. Latest changes changed the syntax but still getting error maybe at an even higher rate.

All questions regarding the TuyaAPI please ask in the project https://github.com/codetheweb/tuyapi .

## Example items

#### create items-file
```
Switch tuya_kitchen_coffeemachine_mqtt "Steckdose Kaffeemaschine" <socket> (<GROUPS>) ["Switchable"] {
    mqtt="<[broker:tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/state:state:default:.*], 
          >[broker:tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/on:command:ON:true], 
          >[broker:tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/off:command:OFF:false]"
}

Switch tuya_livingroom_ledstrip_tv "LED Regal" <lightbulb> (<GROUPS>) ["Lighting"] {
    mqtt="<[broker:tuya/lightbulb/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/state:state:default:.*], 
          >[broker:tuya/lightbulb/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/on:command:ON:true], 
          >[broker:tuya/lightbulb/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/off:command:OFF:false]"
}
```

## Useage
### Basic UI sitemap
```
Switch item=tuya_kitchen_coffeemachine_mqtt mappings=[ON="On", OFF="Off"]
Switch item=tuya_livingroom_ledstrip_tv mappings=[ON="On", OFF="Off"]
```

## Related Projects:
- https://github.com/unparagoned/njsTuya
- https://github.com/clach04/python-tuya
- https://github.com/codetheweb/tuyapi
- https://github.com/Marcus-L/m4rcus.TuyaCore
- Specs: https://docs.tuya.com/en/cloudapi/cloud_access.html

[![forthebadge](https://forthebadge.com/images/badges/made-with-javascript.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)
