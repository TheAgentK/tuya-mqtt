# tuyAPI-MQTT Client
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
git clone git@github.com:TheAgentK/tuya-mqtt.git

// change directory to the project directory
cd tuya-mqtt

//installs this project along with codetheweb/tuyapi project
npm install
```

See the setup instructions found here: https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md


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

//on Linux machines at the bash command prompt:
DEBUG=* tuya-mqtt.js


// on Windows machines at the cmd.exe command prompt:
Set DEBUG=* tuya-mqtt.js
```
URL to [DEBUG](https://www.npmjs.com/package/debug)



### MQTT Topic's (send data)
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
    - tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/{ "multiple": true, "data": { "1": true, "7": true } }

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
    "{ \"multiple\": true, \"data\": { \"1\": true, \"7\": true } }"

Change color of lightbulb (payload as HSB-Color)
    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/color

    Example:
    64,0,100
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
There are some reliability issues with tuyapi. Latest changes changed the syntax but still getting error maybe at an even higher rate.

All questions regarding the tuyAPI please ask in the project https://github.com/codetheweb/tuyapi .


## Example items for OpenHAB 1.x Bindings (still works with OH > 2.4 but only if legacy 1.x MQTT bindings are enabled)
### simple switch on/off
```

Switch tuya_kitchen_coffeemachine_mqtt "Steckdose Kaffeemaschine" <socket> (<GROUPS>) ["Switchable"] {
    mqtt="<[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/state:state:default:.*],
          >[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/on:command:ON:true],
          >[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/off:command:OFF:false]"
}

Switch tuya_livingroom_ledstrip_tv "LED Regal" <lightbulb> (<GROUPS>) ["Lighting"] {
    mqtt="<[broker:tuya/lightbulb/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/state:state:default:.*],
          >[broker:tuya/lightbulb/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/on:command:ON:true],
          >[broker:tuya/lightbulb/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/off:command:OFF:false]"
}

```

### change color of lightbulb
```

# .items
Group gTuyaLivingColor "Tuya color group" <lightbulb>
Color tuya_livingroom_colorpicker "Stehlampe farbe" (LivingDining)

String tuya_livingroom_ledstrip_tv_color "Set color [%s]" (gTuyaLivingColor, LivingDining) {
    mqtt=">[broker:tuya/lightbulb/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/color:command:*:default]"
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
### simple switch on/off

With OpenHAB 2.X MQTT bindings you can add devices using a generic MQTT Thing via PaperUI or 
configuration files.  For PaperUI simply at the generic MQTT Thing and set the state and
command topics as follows:
```

    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/state

    tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command

```

If you prefer using configuration files vs PaperUI, it should look something like this:
See also OpenHAB 2.X MQTT binding [documentation](https://www.openhab.org/v2.4/addons/bindings/mqtt.generic/)

```

Bridge mqtt:broker:myUnsecureBroker [ host="localhost", secure=false ]
{

    Thing mqtt:topic:myCustomMQTT {
    Channels:
        Type switch : tuya_kitchen_coffeemachine_mqtt "Kitchen Coffee Machine MQTT Channel" [
            stateTopic="tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/state",
            commandTopic="tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command",

            // optional custom mqtt-payloads for ON and OFF
            on="{ \"dps\": 1, \"set\": true }",
            off="0"
        ]
    }

}

# *.item Example
Switch tuya_kitchen_coffeemachine_mqtt "Kitchen Coffee Machine Switch" <socket> (gKitchen, gTuya) ["Switchable"] {
    channel="mqtt:topic:myMosquitto:tuya:coffeemachine"
}

```

For one RGB bulb you would need a separate channel with the command topic set to
`tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/color` and link that to your color item.

```

Bridge mqtt:broker:myUnsecureBroker [ host="localhost", secure=false ]
{

    Type colorHSB : livingroom_floorlamp_1_color "Livingroom floorlamp color MQTT Channel" [
        stateTopic="tuya/lightbulb/05200399bcddc2e02ec9/b58cf92e8bc5c899/192.168.178.49/state",
        commandTopic="tuya/lightbulb/05200399bcddc2e02ec9/b58cf92e8bc5c899/192.168.178.49/color"
    ]

}

# *.item Example
Color tuya_livingroom_colorpicker "Floorlamp colorpicker" (gLivingroom){
    channel="mqtt:topic:myMosquitto:tuya:livingroom_floorlamp_1_color"
}

```

#### Basic UI sitemap
```

Switch item=tuya_kitchen_coffeemachine_mqtt


# Colorpicker for Lightbulbs
Colorpicker item=tuya_livingroom_colorpicker label="RGB lamp color" sendFrequency=30000

```

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
