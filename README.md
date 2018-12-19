# TuyaAPI-MQTT Client
MQTT interface for Tuya home automation devices sold under various names.
This is a wrapper script for the Project codetheweb/tuyapi. https://github.com/codetheweb/tuyapi

This project provides an MQTT client for communication with the home automation devices.

:exclamation: There is a greate Step-By-Step guide from user HolgiHab at openhab community ([Step-By-Step Guide](
https://community.openhab.org/t/step-by-step-guide-for-adding-tuya-bulbs-smart-life-to-oh2-using-tuya-mqtt-js-by-agentk/59371)). This guide is not only for light bulbs, but also applies to sockets. :exclamation:

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

Color for lightbulb:

    Example:
    tuya/lightbulb/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/color // Color as Payload as hexColor

Read data from device:
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/dps // returns JSON.stringify(dps) values

    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/dps/<tuya-dps-id> // return single dps data value
```

#### Issues
There are some reliability issues with tuyapi. Latest changes changed the syntax but still getting error maybe at an even higher rate.

All questions regarding the TuyaAPI please ask in the project https://github.com/codetheweb/tuyapi .


## Example items
#### simple switch on/off
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

#### change color of lightbulb
```
# .items
Group gTuyaLivingColor "Tuya color group" <lightbulb>
Color tuya_livingroom_colorpicker "Stehlampe farbe" (LivingDining, Wohnzimmer)

String tuya_livingroom_ledstrip_tv_color "Set color [%s]" (gTuyaLivingColor, LivingDining, Wohnzimmer) {
    mqtt=">[broker:tuya/lightbulb/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/color:command:*:default]"
}

# .rules
import org.openhab.core.library.types.HSBType;

rule "Set HSB value of item RGBLed to RGB color value"
when
	Item tuya_livingroom_colorpicker received command
then
	var appName = "Colorpicker.livingroom"
	var color = receivedCommand.toString;

    // get all colors and send it via mqtt if light ist enabled
	gTuyaLivingColor.members.forEach[ i |
		var name = i.name;
		var stateName = name.toString.split("_color").get(0);
		var stateItem = gTuyaLights.allMembers.filter [ conf | conf.name.contains(stateName.toString) ].head;

		if(stateItem.state == ON){
			logInfo(appName, name + " change to color: " + color);
			i.sendCommand(color);
			Thread::sleep(400);
		}
	]
end

```

#### Basic UI sitemap
```
Switch item=tuya_kitchen_coffeemachine_mqtt mappings=[ON="On", OFF="Off"]
Switch item=tuya_livingroom_ledstrip_tv mappings=[ON="On", OFF="Off"]


# Colorpicker for Lightbulbs
Colorpicker item=tuya_livingroom_colorpicker label="RGB Lampenfarbe" icon="slider" sendFrequency=30000
```

## Related Projects:
- https://github.com/codetheweb/tuyapi
- https://github.com/unparagoned/njsTuya
- https://github.com/clach04/python-tuya
- https://github.com/Marcus-L/m4rcus.TuyaCore
- Specs: https://docs.tuya.com/en/cloudapi/cloud_access.html

[![forthebadge](https://forthebadge.com/images/badges/made-with-javascript.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)
