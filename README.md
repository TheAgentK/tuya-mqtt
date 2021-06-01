# tuya-mqtt

# !!!! Important Note !!!!
This project is currently in maintainance mode.  No further enhancements to this project are planned and will not be planned for the future unless someone out there is interested in becoming the new maintainer.  Please do not open issues to request new features, new device support, etc, as they will likely be closed with no comment.  I will try to support existing functionality, but even this will likely be on a very limited basis.  If you are interested in maintaining this project, please post [here](https://github.com/rospogrigio/localtuya/issues/194).

I have decided to step away from this project as I've made the personal decision to rid myself of any Tuya Wifi based devices (I'm down to only 4 at this point, and they are all easy to replace or at least flash with Tasmota).  This decision was made due to the fact that Tuya continues to make it more and more difficult to control their devices locally.  While I don't blame them for this, these devices were only interesting to me because of this local control and thus I can no longer meet my personal goals with Tuya devices (at least the Wifi ones) so I will no longer be purchasing/using them going forward.

# About
This project is a bridge that allows locally controlling IOT devices manufactured by Tuya Inc., and sold under many different brands, via simple MQTT topics.  It effectively translate the Tuya protocol to easy to use topics.

Using this script requires obtaining the device ID and local keys for each of your devices after they are configured via the Tuya/Smart Life or other Tuya compatible app (there are many).  With this information it is possible to communicate locally with Tuya devices using Tuya protocol version 3.1 and 3.3 without using the Tuya Cloud service, however, getting the keys requires signing up for a Tuya IOT developer account or using one of several other alternative methods (such as dumping the memory of a Tuya based app running on Android).

To acquire keys for your device please see the instructions at the TuyAPI project (on which this script is based) available at the [TuyAPI GitHub site](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md).

**Acquiring device keys is outside the scope of this project!** Issues opened regarding acquiring keys will likely be closed without comment. Please verify that your device can be queried and controlled via tuya-cli before opening any issue.  If your device can't be controlled by tuya-cli then it cannot be used with this project.

**!!!!!!!!!! Important information regarding the 3.0 release !!!!!!!!!!**\
The 3.0.0 release (Oct 17th, 2020) is a major refactor of the tuya-mqtt project and, as such, is a breaking release for all users of previous versions.  Almost everything about the project is different, including configuration method, topic names, etc.  Upgrading users should carefully read the instructions below and assume they are starting over from scratch.

## Installation
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
Tuya-mqtt has two different configuration files.  The first is config.json, a simple file which contains settings for connection to the MQTT broker.  The second is devices.conf, a JSON5 formatted file which defines the Tuya devices that the script should connect to and expose via MQTT.  This file uses the same basic format as the "tuya-cli wizard" outputs when used to acquire the device keys, so it can be used as the basis for your tuya-mqtt device configuration.

### Setting up config.json:
```
cp config.json.sample config.json
```
Edit config.json with your MQTT broker settings and save:
```
nano config.json 
```

### Setting up devices.conf:
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
```
Note that, because the format is JSON5, which is a superset of JSON, you can use standard, strict JSON syntax, or the more forgiving JSON5 format, or even mix and match in the same file.

By default tuya-mqtt will attempt to find the device and automatically detect the Tuya protocol version, however, this only works if the system running tuya-mqtt is on the same network/subnet as the devices being controlled.  If this is not the case, or if automatic detection fails for some other reason, it is possible to specify the IP address and protocol manually by adding the "ip:" property to the devices.conf file.  Note that if the IP address is specified manually it is required to also manually specify the protocol version using the "version:" parameter as either "3.1" or "3.3".  The easiest way to determine the protocol version is to try controlling the device with tuya-cli and try each version to see which one works.

While the above syntax may be enough to create a working tuya-mqtt install with raw DPS values accessible via DPS topics, the full functionality of tuya-mqtt 3.0 is only unlocked by configuring device types to get.  Please see the full [DEVICES](docs/DEVICES.md) documentation for details.

### Starting tuya-mqtt
```
node tuya-mqtt.js
```
To enable debugging output (required when opening an issue):
```
DEBUG=tuya-mqtt:* tuya-mqtt.js
```

### Updating devices.conf with new and/or changed devices:
After adding or changing devices to your Tuya account the devices.conf file can be automatically updated with all new devices and name/key changes by using the merge-devices.js script.  Create a file named new-devices.conf with the new "tuya-cli wizard" output then run ```node merge-devices.js```.  A dated backup of the original devices.conf file will be created automatically before changes are made.  Devices are only added and updated, never removed.  The resulting devices.conf file will be neatly formatted and sorted alphabetically by device name.

To prevent device entries from being updated by the merge script, add property "allowMerge: false" to the device definition in the devices.conf file.

### Usage Overview
Tuya devices work by mapping device functions to various values stored in data points (referred to as DPS values) which are referenced via an index number, referred to as the DPS key.  For example, a simple on/off switch may have a single DPS value, stored in DPS kep 1 (DPS1).  This value is likely to have a setting of true/false representing the on/off state of the device.  The device state can be read via DPS1, and, for values that can be changed (some DPS values are read-only), sending true/false to DPS1 will turn the device on/off.  A simple dimmer might have the same DPS1 value, but an additional DPS2 value from 1-255 representing the state of the dimmer.  More complex devices use more DPS keys with various values representing the states and control functions of the device.

The tuya-mqtt script provides access to these DPS keys and their values via MQTT, allowing any tool that can use MQTT to monitor and control these devices via a local network connection.  In addition to providing access to the raw DPS data, there is also a template engine that allows those DPS values to be mapped to device specific topics, called "friendly topics", allowing for consistent mapping even between devices that use different DPS keys for the same functions.  These friendly topics also support various transforms and other functions that make it easier for other devices to communicate with Tuya devices without a detailed understanding of the data formats Tuya devices use.

### MQTT Topic Overview
The top level topics are created using the device name or ID as the primary identifier.  If the device name is available, it will be converted to lowercase and any spaces replace with underscores('_') characters so, for example, if the device as the name "Kitchen Table", the top level topic would be:
```
tuya/kitchen_table/
```
If the device name was not available in the devices.conf file, tuya-mqtt falls back to using the device ID for the top level topic:
```
tuya/86435357d8b123456789/
```
All additional state/command topics are then built below this level. You can view the connectivity status of the device using the status topic, which reports online/offline based on whether tuya-mqtt has an active connection to the device or not.  The script monitors both the device socket connection for errors and also device heartbeats, to report proper status. 
```
tuya/kitchen_table/state --> online/offline
```
You can also trigger the device to send an immediate update of all known device DPS topics by sending the message "get-states" to the command topic (this topic exist for all devices):
```
tuya/kitchen_table/command <-- get-states
```
As noted above, tuya-mqtt supports two distinct topic types for interfacing with and controlling devices. For all devices, the DPS topics are always published and commands are accepted, however, friendly topics are the generally recommended approach but require you to use a pre-defined device template or create a customer template for your device when using the generic device.

If you do create a template for your device, please feel free to share it with the community as adding additional pre-defined devices is desired for future versions of tuya-mqtt.  There is a templates section of the project that you can submit a PR for your templates.

If you would like to use the raw DPS topics, please jump to the [DPS topics](#dps-topics) section of this document.

## Friendly Topics
Friendly topics are only available when using a pre-defined device template or, for the generic device, when you have defined a custom template for your device.  Friendly topics use the tuya-mqtt templating engine to map raw Tuya DPS key values to easy to consume topics and transform the data where needed.

Another advantage of friendly topics is that not all devices respond to schema requests (i.e. a request to report all DPS topics the device uses).  Because of this, it's not always possible for tuya-mqtt to know which DPS topics to acquire state information from during initial startup.  With a defined template the required DPS keys for each friendly topic are configured and tuya-mqtt will always query these DPS key values during initial connection to the device and report their state appropriately.

For more details on using friendly topics, please read the [DEVICES](docs/DEVICES.md) documentation which discusses how to configure supported devices or define a custom template.

## DPS Topics
Controlling devices directly via DPS topics requires enough knowledge of the device to know which topics accept what values.  Described below are two different methods for interfacing with DPS values, the JSON DPS topic, and the individual DPS key topics.

### DPS JSON topic
The JSON DPS topic allows controlling Tuya devices by sending Tuya native style JSON messages to the command topic, and by monitoring for Tuya style JSON replies on the state topic.  You can get more details on this format by reading the [TuyAPI documentation](https://codetheweb.github.io/tuyapi/index.html), but, for example, to turn off a dimmer switch you could issue a MQTT message containing the JSON value ```{dps: 1, set: false}``` to the DPS/command topic for the device.  If you wanted to turn the dimmer on, and set brightness to 50%, you could issue separate messages ```{dps: 1, set: true}``` and then ```{dps: 2, set: 128}```, or, the Tuya JSON protocol also allows setting multiple values in a single set command using the format ```{'multiple': true, 'data': {'1': true, '2': 128}}```.  JSON state and commands should use the DPS/state and DPS/command topics respectively.  Below is an example of the topics:
```
tuya/dimmer_device/DPS/state
tuya/dimmer_device/DPS/command
```
### DPS Key topics
In addition to the JSON DPS topic, it's also possible to use the DPS key topics.  DPS key topics allow you to monitor and send simple bool/number/string values directly to DPS keys without having to use the Tuya JSON format, the conversion to Tuya JSON is handled by tuya-mqtt.  Using the example from above, turning on the dimmer and setting brightness to 50% you would simply issue the message "true" to DPS/1/command and the message "128" to DPS/2/command.
```
tuya/dimmer_device/DPS/1/state    --> true/false for on/off state
tuya/dimmer_device/DPS/2/command  <-- 1-255 for brightness state
tuya/dimmer_device/DPS/1/state    --> accept true/false for turning device on/off
tuya/dimmer_device/DPS/2/command  <-- accepts 1-255 for controlling brightness level
```
**!!! Important Note !!!**
When sending commands directly to DPS values there are no limitation on what values are sent as tuya-mqtt has no way to know what are valid vs invalid for any given DPS key.  Sending values that are out-of-range or of different types than the DPS key expects can cause unpredictable behavior of your device, from causing timeouts, to reboots, to hanging the device.  While I've never seen a device fail to recover after a restart, please keep this in mind when sending commands to your device.

## Issues
Not all Tuya protocols are supported.  For example, some devices use protocol 3.2 which currently remains unsupported by the TuyAPI project due to lack of enough information to reverse engineer the protocol.  If you are unable to control your devices with tuya-mqtt please verify that you can query and control them with tuya-cli first.  If tuya-cli works, then this script should also work, if it doesn't then this script will not work either.

## Integration with other Home Automation tools
openHAB examples are [here](docs/openHAB.md).

## Contributors
- [TheAgentK](https://github.com/TheAgentK)
- [tsightler](https://github.com/tsightler)
- [Tycale](https://github.com/Tycale)
- [crashdummymch](https://github.com/crashdummymch)
- [GadgetAngel](https://github.com/GadgetAngel)
- [dkrahmer](https://github.com/dkrahmer)

## Related Projects:
- https://github.com/codetheweb/tuyapi
- https://github.com/unparagoned/njsTuya
- https://github.com/clach04/python-tuya
- https://github.com/Marcus-L/m4rcus.TuyaCore
- Specs: https://docs.tuya.com/en/cloudapi/cloud_access.html

[![forthebadge](https://forthebadge.com/images/badges/made-with-javascript.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)
