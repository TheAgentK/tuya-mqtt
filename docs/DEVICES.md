# tuya-mqtt - Devices
The most powerful feature in tuya-mqtt is the ability to configure devices to use friendly topics.  For some devices there exist pre-defined device templates which makes using those devices quite easy, simply add the type information to the devices.conf file and tuya-mqtt automatically creates friendly topics for that device.

Friendly topics make it easy to communicate with the device in a standard way and thus integrating into various Home Automation platforms.  The topic style generally follows that used by the Home Assistant MQTT integration components and the pre-defined devices automatically send Home Assistant style MQTT discovery messages during startup to make integration with Home Assistant, or other platforms which understand Home Assistant MQTT discovery, even easier.

If the device does not have a pre-defined device template, it's possible to create a template using the [generic device template](#generic-device-templates) feature.

## Pre-defined Device Templates
Pre-defined device templates (except for the Generic Device) will always expose friendly topics for the given device in a consistent manner.  Currently the following pre-defined device templates are available:

| Device Type | Descrition |
| --- | --- |
| SimpleSwitch | Supports simple on/off devices |
| SimpleDimmer | Supports simple devices with on/on and brightness |
| RGBTWLight | Supports color/white lights with optional color temerature support |
| GenericDevice | Allows defining a custom template for any device |

To use a device template, simply add the "type" option to the devices.conf similar to the following example:
```
[
  {
    name: 'Tuya Device 1',
    id: '86435357d8b123456789',
    key: '8b2a69c9876543210',
    type: 'RGBTWLight'
  }
]
```
Once the device type is defined tuya-mqtt will attempt to create friendly topics for that device type on connection to the device.  Each device type defines specific defaults for DPS values which are typical for common Tuya devices and some, like RGBTWLight, have logic to attempt to detect different variation by querying the device.  The goal is that, in most cases, simply adding the type is all that is needed, however, in many cases it is also possible to override the manual settings for the device.  The device friendly topics and options for each device are documented below.

### SimpleSwitch
Simple devices that support only on/off.
| Topic | Description | Values |
| --- | --- | --- |
| state | Power state | on/off |
| command | Set power state | on/off, 0/1, true/false |

Manual configuration options:
| Option | Description | Default |
| --- | --- | --- |
| dpsPower | DPS key for power state | 1 |

### SimpleDimmer
Simple device with on/off and brightness functions (dimmer switches or lights)
| Topic | Description | Values |
| --- | --- | --- |
| state | Power state | on/off |
| command | Set power state | on/off, 0/1, true/false |
| brightness_state | Brightness in % | 0-100 |
| brightness_command | set brightness in % | 0-100 |

Manual configuration options:
| Option | Description | Default |
| --- | --- | --- |
| dpsPower | DPS key for power state | 1 |
| dpsBrightness | DPS key for brightness state | 2 |
| brightnessScale | Scale for brightness DPS value | 255 |

### RGBTWLight
The RGBTWLight device support Tuya color lights (bulbs and LEDs). Tuya lights operate in either white or color mode.  The RGBTWLight device automatically switches between modes on certain conditions as documented below:
| Condition | Mode |
| --- | --- |
| Changes white brightness | white |
| Changes to color temperature (for device with color temp support) | white |
| Saturation < 10 % | white |
| Saturation >= 10 % | color |
| All other changes | current mode |

This means changing the hue of the light will only switch to color mode if saturation is also >= 10%.  Some lights automatically attempt to switch to color mode when any HSB value is updated however, if the saturation setting remains < 10%, tuya-mqtt will force the light back to white mode in this case.  This can cause a very quick flicker when chaning hue or color brightness while the saturation remains below the 10% threshold.  I expect this not to be a common issue and implemented this in an attempt to make all tuya lights behave in a consistent way.

When the bulb is in white mode, saturation values in the friendly topics are always reported as 0%.  This is true even if the mode is toggled manually from color to white mode using the mode_command topic or the Tuya/SmartLife app.  When the light is toggled back to color mode, saturation will be reported at the correct level.  This is done primarly as a means to indicate color state to automation platforms that don't have a concept of white/color mode, otherwise a light in white mode may still be represented with a color icon in the platforms UI.

Not all devices support color temperature and the script attempts to detect this capability and enables the color temperature topics only when found.  Color temperature topics report in Mireds (commonly used by automation tools) and the default range supports roughly 2500K-6500K.  This works reasonably well for most available Tuya devices, even if they are not exactly in this range, but, if you know a devices specific color range, the limits can be manually specified to more accurately reflect the exact color temperature.

Tuya bulbs store their HSB color value in a single DPS key using a custom format.  Some bulbs use a 14 character format, referred to as HSBHEX, which represents the saturation and brightness values from 0-255 as 2 character hex, while the others use a 12 character format, referred to as HSB, which still uses hex values, but stores saturation and brightness values from 0-1000 as 4 character hex.  The code attempts to autodetect the format used by the bulb and perform the proper conversion in all cases, but this can be overridden for cases where the dection method fails.

| Topic | Description | Values |
| --- | --- | --- |
| state | Power state | on/off |
| command | Set power state | on/off, 0/1, true/false |
| white_brightness_state | White mode brightness in % | 0-100 |
| white_brightness_command | Set white mode brightness in % | 0-100 |
| color_brightness_state | Color mode brightness in % | 0-100 |
| color_brightness_command | Set white mode brightness in % | 0-100 |
| hs_state | Hue, saturation % | H,S (Hue 0-360, Saturation 0-100) |
| hs_command | Set hue, saturation % | H,S (Hue 0-360, Saturation 0-100) |
| hsb_state | Hue, saturation %, brightness % | H,S,B (Hue 0-360, Saturation 0-100, Brightness 0-100) |
| hsb_command | Set hue, saturation %, brightness % | H,S,B (Hue 0-360, Saturation 0-100, Brightness 0-100) |
| mode_state | White/Color mode | 'white', 'colour' (some devices also support scenes here) |
| mode_command | Set white/color mode | 'white', 'colour' (some devices also support scenes here) |
| color_temp_state | Color temperature in mireds (only available if device support color temp) | 154-400 (defult range, can be overridden) |
| color_temp_command | Set color temperature in mireds (only available if device support color temp)  | 154-400 (defult range, can be overridden) |

Manual configuration options:
| Option | Description | Default (common detected values) |
| --- | --- | --- |
| dpsPower | DPS key for power state | Auto Detect (1,20) |
| dpsMode | DPS key for white/color mode state | Auto Detect (2,21) |
| dpsWhiteValue | DPS key for white mode brightness | Auto Detect (3,22) |
| whiteValueScale | White mode brightness DPS scale | Auto Detect (255, 1000) |
| dpsColorTemp | DPS key for color temperature | Auto Detect (4,23) |
| minColorTemp | Min color temperature in Mireds | 154 (~6500K) |
| maxColorTemp | Max color temperature in Mireds | 400 (~2500K) |
| colorTempScale | Color temperature DPS key scale | Auto Detect (255, 1000) |
| dpsColor | DPS key for HSB color values | Auto Detect (5,24) |
| colorType | Tuya color format for color DPS key | Auto Detect (hsb, hsbhex) |

To use the manual configuration options simply add them to device.conf file after defining the device type like the following example:
```
[
  {
    name: 'Tuya Device 1',
    id: '86435357d8b123456789',
    key: '8b2a69c9876543210',
    type: 'RGBTWLight',
    dpsPower: 31,
    dpsMode: 32,
    dpsWhiteValue: 33,
    whiteValueScale: 255,
    dpsColorTemp: 34,
    minColorTemp: 165,
    maxColorTemp: 385,
    colorTempScale: 255,
    dpsColor: 34,
    colorType: 'hsbhex'
  }
]
```

## Generic Device Templates
If a pre-defined device tempate does not exist for the device, or does not expose all capabilities of the device, there are still mulitple options available to control the devices.  One method is to use the DPS topics directly to control the device using either native Tuya JSON commands or via the DPS key values by using the DPS key topics (see [DPS Topics](TOPICS.md#dps-topics)).  The second method is to create a template for your device to map DPS key values to friendly topics.  The GenericDevice type allows you to manually create a template for any device using the same templating engine as the pre-defined device templates.  Once you've created a tempalte for your device, it can be re-used with other, similar devices and you can submit your template to the tuya-mqtt project for other to use, or even for inclusion at a pre-defined device template in the future.

Creating a device template is relatively straightforward, but first you must know what DPS keys your devices uses.  The GenericDevice attempts to query all device DPS states on startup, but some devices to not respond to this command, however, the generic device will ALWAYS report any DPS topics from which it receives upated.  The easiest way to determine how your device uses it's DPS topics is to connect to the MQTT broker via a tool like MQTT Explorer or mosquitto_sub, and watch the topics as you manipulate the device with the Tuya/Smartlife app.

Once you have a reasonable idea of how the device uses it's DPS key values, you can create a template.  A simple template for a dimmer looks something like this:
```
[
  {
    name: 'Tuya Device 1',
    id: '86435357d8b123456789',
    key: '8b2a69c9876543210',
    template: {
      state: {
        key: 1,
        type: 'bool'
      },
      brightness_state: { 
        key: 2,
        type: 'int',
        topicMin: 1,
        topicMax: 100,
        stateMath: '/2.55',
        commandMath: '*2.55'
      }
    }
  }
]
```
The template above defines two topics "state" and "brightness_state", and the template engine automatically creates the corresponding command topics, in this case specifically "command" and "brightness_command".

The "state" topic maps to DPS key 1, and uses a bool (true/false) value in the DPS key.  Now you will be able to see "on/off" state in the state topic instead of having to read the true/false value from the DPS/1 topic

The the "brightness_state" topic maps to DPS key 2, and this value defines the brightness using an integer in the 1-255 scale.  We define the value as an integer (type: 'int') and the stateMath and commandMath values allow transforming the raw DPS value into a more friendly value that will be presented in the topic.  In this case the raw DPS value will be divided by 2.55 before being published to the state, and and received commands will be mulitpled by that same value, converting the 1-255 to a simple 1-100 scale.  Note that the topicMin and topicMax values set the minimum and maximum values that the state topic will report and that the command topic will accept.  These values are "post-math" for state topics, and "pre-math" for command topics.

The following tables define the available template value types and their options:

### Boolean values
| option | value |
| --- | --- |
| type | 'bool' |
| key | DPS key of the value |

### Integer values
| option | value |
| --- | --- |
| type | 'int' |
| key | DPS key of the value |
| topicMin | Minumum value allowed for the command topic |
| topicMax | Maximum value allowed for the command topic | 
| stateMath | Simple math applied to the DPS key value before being published to state topic |
| commandMath | Simple math applied to command value before being set to DPS key |

### Floating point values
| option | value |
| --- | --- |
| type | 'float' |
| key | DPS key of the value |
| topicMin | Minumum value allowed for the command topic |
| topicMax | Maximum value allowed for the command topic | 
| stateMath | Simple math applied to the DPS key value before being published to state topic |
| commandMath | Simple math applied to command value before being set to DPS key |

### String values
| option | value |
| --- | --- |
| type | 'str' |
| key | DPS key of the value |

### Tuya HSB values (newer style Tuya, 12 character color value)
| option | value |
| --- | --- |
| type | 'hsb' |
| key | DPS key of the value |
| components | Comma separated list of HSB components that should be included in this topic |

### Tuya HSBHEX values (older style Tuya 14 character color value)
| option | value |
| --- | --- |
| type | 'hsbhex' |
| key | DPS key of the value |
| components | Comma separated list of HSB components that should be included in this topic |

Using these value types you can define templates for a wide range of devices.  Additional types and options are likely to be included in future versions of tuya-mqtt.
