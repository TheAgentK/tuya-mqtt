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

// clone this project
git clone git@github.com:TheAgentK/tuyaapi_mqtt.git

// change directory to the project directory
cd tuyaapi_mqtt

//installs this project along with codetheweb/tuyapi project
npm install 
```

This involves MIM of the connection. Instructions can be found here: https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md

Create your configuration file:
```
cp config.json.sample config.json
// edit the configuration file
nano config.json 
```

Start command
```
node tuya-mqtt.js

// For debugging purpose, to use DEBUG you must first install the debug from npm
// to install debug use this command at the command prompt: npm install debug
// here is the url to help install debug : https://www.npmjs.com/package/debug
// after you have installed debug then on Linux machines at the bash command prompt:
DEBUG=* tuya-mqtt.js
// on Windows machines at the cmd.exe command prompt:
Set DEBUG=* tuya-mqtt.js
```
URL to [DEBUG](https://www.npmjs.com/package/debug) 

MQTT Topic
```
Current device state:
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/state

Change device state (by topic):
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/<STATE>
	
    Example:
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/on
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/off
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/ON
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/OFF
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/1
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/0
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/toggle
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/TOGGLE
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/{ "dps": 1, "set": true }
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/{ "multiple": true, "data": { "1": true, "7": true } }
 

Change device state (by payload)
Use with OpenHAB 2.X MQTT bindings or others where only a single command topic is preferred:
NOTE: notice that nothing follows the word command, DO NOT but a "/" in after command.

    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command 
    
    in the Generic MQTT Thing where on="" and off="" is declared place the following in on=" " or off=" " section:
    "ON"
    "OFF"
    "on"
    "off"
    "1"
    "0"
    "toggle"
    "TOGGLE"
    "{ \"dps\": 1, \"set\": true }"
    "{ \"multiple\": true, \"data\": { \"1\": true, \"7\": true } }"
    
	
Color for lightbulb:

    Example:
    // Color as Payload as hexColor
    tuya/lightbulb/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/color 

Read data from device:
    // returns JSON.stringify(dps) values, use this to force communications with each tuya device.  I recommand sending
    // this command twice in a row when your system restarts.
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/{ "schema": true }
    
    // returns the status for the specified dps index and sets the STATE topic to its status
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command/{ "dps": 7 }

    if { "schema": true } is sent the STATE topic will be equal to the status of dps 1.
```

#### Issues
There are some reliability issues with tuyapi. Latest changes changed the syntax but still getting error maybe at an even higher rate.

All questions regarding the TuyaAPI please ask in the project https://github.com/codetheweb/tuyapi .


## Example items for OpenHAB 1.x Bindings (still works with >2.4 but only if legacy 1.x MQTT bindings are enabled)
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
## Example items for OpenHAB 2.4 Bindings
#### simple switch on/off

With OpenHAB 2.X MQTT bindings you can add devices using a generic MQTT Thing via PaperUI or 
configuration files.  For PaperUI simply at the generic MQTT Thing and set the state and
command topics as follows:
```
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/state	
    tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command
```	
If you prefer using configuration files vs PaperUI, it should look something like this:

```
Bridge mqtt:broker:myUnsecureBroker [ host="192.168.0.42", secure=false ]
{
    Thing mqtt:topic:mything {
    Channels:
        Type switch : tuya_kitchen_coffeemachine_mqtt "Kitchen Coffee Machine MQTT Channel" [ stateTopic="tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/state", commandTopic="tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/command", on="{ \"dps": 1, \"set\": true }, off="0" ]
    }
}
```
For a light with color you would need a separate channel with the command topic set to
tuya/<tuyaAPI-type>/<tuyaAPI-id>/<tuyaAPI-key>/<tuyaAPI-ip>/color and link that to your 
color item.

#### Basic UI sitemap
```
Switch item=tuya_kitchen_coffeemachine_mqtt mappings=[ON="On", OFF="Off"]
Switch item=tuya_livingroom_ledstrip_tv mappings=[ON="On", OFF="Off"]


# Colorpicker for Lightbulbs
Colorpicker item=tuya_livingroom_colorpicker label="RGB Lampenfarbe" icon="slider" sendFrequency=30000
```

## Contributors
- [TheAgentK](https://github.com/TheAgentK)
- [tsightler](https://github.com/tsightler)
- [Tycale](https://github.com/Tycale)


## Related Projects:
- https://github.com/codetheweb/tuyapi
- https://github.com/unparagoned/njsTuya
- https://github.com/clach04/python-tuya
- https://github.com/Marcus-L/m4rcus.TuyaCore
- Specs: https://docs.tuya.com/en/cloudapi/cloud_access.html

[![forthebadge](https://forthebadge.com/images/badges/made-with-javascript.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)
