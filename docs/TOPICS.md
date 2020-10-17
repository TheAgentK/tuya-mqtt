# tuya-mqtt Topics
tuya-mqtt support two styles of topics for devices.  For all devices the DPS topics are always published and commands are accepted, however, friendly topics allow mapping DPS values into friendier topics names with more control over allowed values, and allow simple functions like math transforms, etc.  While it's always possible to use the DPS topics directly, friendly topics are the generally recommended approach but require you to create a template for your device if it doesn't match one of the pre-defined templates.

If you create a template for your device, please feel free to share it with the community as adding additional pre-defined devices is desired for future versions of tuya-mqtt.

If you would like to use the raw DPS topics, please jump to the DPS topic section of this document.

## Friendly Topics
Friendly topics are only available when using a pre-defined device template or, when using the generic device, when you have defined a custom template.  Friendly topics use a simple templating engine to map raw Tuya DPS key values to easy to consume topic and transform the data where needed.  The other advantage to using friendly topics is that not all devices respond to schema requets so it's not always possible for tuya-mqtt to know which DPS topics to acquire state information from during startup.  With a template the required DPS topics are configured and tuya-mqtt will always query these individual values during initial connection to the device.

When using pre-device device templates, please see the appropriate section in the [DEVICES](docs/DEVICES.md) documentation.  When using a generic device, you can define a template in the devices.conf file.  Imagine a simple dimmer with key 1 representing on/off and key 2 represeting brightness.  When using just the basic devices.conf file, controlling a device requires using the DPS topics directly, for example:
```
tuya/dimmer_device/DPS/1  <-- true/false for state and control
tuya/dimmer_device/DPS/2  <-- value 1-255, for state and control, accepts invalid values, etc.

```
While this will work, in this case the automation system would need to understand true/false vs on/off, and would need to be manually configured for 1-255 scale instead of, for example, a 1-100% scale (some systems deal with this quite easily, others, not so much).  However, using a template you can quickly create an easy to use set of friendly topics with easier to consume values:
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
        min: 1,
        max: 255,
        stateMath: '/2.55',
        commandMath: '*2.55'
      }
    }
  }
]
```
Now, controlling the device can be done with the following topics:
```
tuya/dimmer_device/state             <-- Reports ON/OFF
tuya/dimmer_device/command           <-- Accepts 0/1, on/off, or true/false
tuya/dimmer_device/brightness_state  <-- Reports 1-100 scale for brightness %
tuya/dimmer_device/brightness_state  <-- Accepts 1-100 scale for brightness %
```
More complex mappings are possible.  All pre-defined device templates use the same, built-in, templating engine, so further examples can been seen by browsing the source code of the device files.  Below are the available options for each value type:

### Boolean values
| type | 'bool' |
| key | DPS key for the value |

### Integer values
| type | 'int' |
| key | DPS key for the value |
| min | Minumum value allowed for the command topic |
| max | Maximum value allowed for the command topic | 
| stateMath | Simple math applied to the DPS key value before being published to state topic |
| commandMath | Simple math applied to command value before being set to DPS key |

### Floating point values
| type | 'float' |
| key | DPS key for the value |
| min | Minumum value allowed for the command topic |
| max | Maximum value allowed for the command topic | 
| stateMath | Simple math applied to the DPS key value before being published to state topic |
| commandMath | Simple math applied to command value before being set to DPS key |

### String values
| type | 'string' |
| key | DPS key for the value |

### Tuya HSB values (newer style Tuya, 12 character color value)
| type | 'hsb' |
| key | DPS key for the value |
| components | Comma separated list of HSB components that should be included in this topic |

### Tuya HSBHEX values (older style Tuya 14 character color value)
| type | 'hsbhex' |
| key | DPS key for the value |
| components | Comma separated list of HSB components that should be included in this topic |

## DPS Topics
Controlling devices directly via DPS topics requires enough knowledge of the device to know which topics accept what values.  There are actually two differnt methods interfacing with DPS values, the JSON DPS topic, and the individual DPS key topics.

### JSON DPS Topics
The JSON DPS topic allows controlling Tuya devices by sending raw, Tuya style JSON messages to the command topic, and by monitoring for Tuya style JSON replies on the state topic.  You can get more details on this format by reading the [TuyAPI documentaiton](https://codetheweb.github.io/tuyapi/index.html), but, for example, to turn off a dimmer switch you could issue a MQTT message containing the JSON value {dps: 1, set: false} to the DPS/command topic for the device.  If you wanted to turn the dimmer on, and set brightness to 50%, you could issue separate messages {dps: 1, set: true} and then {dps: 2, set: 128}, or, the Tuya JSON protocol also allows setting multiple values in a single set command using the format {'multiple': true, 'data': {'1': true, '2': 128}}.  JSON state and commands should use the DPS/state and DPS/command topics respectively.  Below is an example of the topics:
```
tuya/dimmer_device/DPS/state
tuya/dimmer_device/DPS/command
```
In addition to the JSON DPS topic, it's also possible to use the DPS key topics.  DPS key topics allow you to monitor and send simple bool/number/string values directly to DPS keys without having to use the Tuya JSON format, the conversion to Tuya JSON is handled by tuya-mqtt.  Using the example from above, turning on the dimmer and setting brightness to 50% you would simply issue the message "true" to DPS/1/command and the message "128" to DPS/2/command.
```
tuya/dimmer_device/DPS/1/state    <-- true/false for on/off state
tuya/dimmer_device/DPS/2/command  <-- 1-255 for brightness state
tuya/dimmer_device/DPS/1/state    <-- accept true/false for turning device on/off
tuya/dimmer_device/DPS/2/command  <-- accepts 1-255 for controlling brightness level
```
**!!! Important Note !!!** When sending commands directly to DPS values there are no controls on what values are sent as tuya-mqtt has no way to know what are valid vs invalid values.  Sending values that are out-of-range or of different types can cause unpredicatable behavior of your device, from causing timeouts, to reboots, to hanging the device.  While I've never seen a device not recover after a restart, please keep this in mind when sending commands to your device.