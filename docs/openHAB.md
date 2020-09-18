:exclamation: There is a greate Step-By-Step guide from user HolgiHab at openhab community ([Step-By-Step Guide](
https://community.openhab.org/t/step-by-step-guide-for-adding-tuya-bulbs-smart-life-to-oh2-using-tuya-mqtt-js-by-agentk/59371)). This guide is not only for light bulbs, but also applies to sockets. :exclamation:

## Example items for OpenHAB 1.x Bindings (still works with OH > 2.4 but only if legacy 1.x MQTT bindings are enabled)
### simple switch on/off
```

Switch tuya_kitchen_coffeemachine_mqtt "Steckdose Kaffeemaschine" <socket> (<GROUPS>) ["Switchable"] {
    mqtt="<[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/state:state:default:.*],
          >[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/on:command:ON:true],
          >[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/off:command:OFF:false]"
}

Switch tuya_livingroom_ledstrip_tv "LED Regal" <lightbulb> (<GROUPS>) ["Lighting"] {
    mqtt="<[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/state:state:default:.*],
          >[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/on:command:ON:true],
          >[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/command/off:command:OFF:false]"
}

```

### change color of lightbulb
```

# .items
Group gTuyaLivingColor "Tuya color group" <lightbulb>
Color tuya_livingroom_colorpicker "Stehlampe farbe" (LivingDining)

String tuya_livingroom_ledstrip_tv_color "Set color [%s]" (gTuyaLivingColor, LivingDining) {
    mqtt=">[broker:tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/color:command:*:default]"
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
        Type switch : tuya_kitchen_coffeemachine_mqtt_channel "Kitchen Coffee Machine MQTT Channel" [
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
    channel="mqtt:topic:myUnsecureBroker:myCustomMQTT:tuya_kitchen_coffeemachine_mqtt_channel"
}

```

For one RGB bulb you would need a separate channel with the command topic set to
`tuya/<tuyAPI-id>/<tuyAPI-key>/<tuyAPI-ip>/color` and link that to your color item.

```

Bridge mqtt:broker:myUnsecureBroker [ host="localhost", secure=false ]
{
    Thing mqtt:topic:myCustomMQTT {
    Channels:
        Type colorHSB : livingroom_floorlamp_1_color "Livingroom floorlamp color MQTT Channel" [
            stateTopic="tuya/05200399bcddc2e02ec9/b58cf92e8bc5c899/192.168.178.49/state",
            commandTopic="tuya/05200399bcddc2e02ec9/b58cf92e8bc5c899/192.168.178.49/color"
        ]
    }
}

# *.item Example
Color tuya_livingroom_colorpicker "Floorlamp colorpicker" (gLivingroom){
    channel="mqtt:topic:myUnsecureBroker:myCustomMQTT:livingroom_floorlamp_1_color"
}

```

#### Basic UI sitemap
```

Switch item=tuya_kitchen_coffeemachine_mqtt

# turn the color bulb off or on
Switch item=tuya_livingroom_colorpicker label="RGB lamp [%s]" 

# pick the color level to send to the color bulb via MQTT color Channel
Slider item=tuya_livingroom_colorpicker label="RGB lamp level [%s]" minValue=0 maxValue=100 step=1

# color picked and sent via MQTT Color channel
Colorpicker item=tuya_livingroom_colorpicker label="RGB lamp color [%s]" icon="colorpicker" sendFrequency=30000


```
