const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya-mqtt:device')
const debugDiscovery = require('debug')('tuya-mqtt:discovery')
const utils = require('../lib/utils')

class SimpleDimmer extends TuyaDevice {
    async init() {
        // Set device specific variables
        this.config.dpsPower = this.config.dpsPower ? this.config.dpsPower : 1
        this.config.dpsBrightness = this.config.dpsBrightness ? this.config.dpsBrightness : 2
        this.config.brightnessScale = this.config.brightnessScale ? this.config.brightnessScale : 255

        this.deviceData.mdl = 'Dimmer Switch'

        // Set white value transform math
        let brightnessStateMath
        let brightnessCommandMath
        if (this.config.brightnessScale === 255) {
            // Devices with brightness scale of 255 seem to not allow values
            // less then 25 (10%) without producing timeout errors.
            brightnessStateMath = '/2.3-10.86'
            brightnessCommandMath = '*2.3+25'
        } else {
            // For other scale (usually 1000), 10-1000 seems OK.
            brightnessStateMath = '/('+this.config.brightnessScale+'/100)'
            brightnessCommandMath = '*('+this.config.brightnessScale+'/100)'
        }

        // Map generic DPS topics to device specific topic names
        this.deviceTopics = {
            state: {
                key: this.config.dpsPower,
                type: 'bool'
            },
            brightness_state: { 
                key: this.config.dpsBrightness,
                type: 'int',
                topicMin: 0,
                topicMax: 100,
                stateMath: brightnessStateMath,
                commandMath: brightnessCommandMath
            }
        }

        // Send home assistant discovery data and give it a second before sending state updates
        this.initDiscovery()
        await utils.sleep(1)

        // Get initial states and start publishing topics
        this.getStates()
    }

    initDiscovery() {
        const configTopic = 'homeassistant/light/'+this.config.id+'/config'

        const discoveryData = {
            name: (this.config.name) ? this.config.name : this.config.id,
            state_topic: this.baseTopic+'state',
            command_topic: this.baseTopic+'command',
            brightness_state_topic: this.baseTopic+'brightness_state',
            brightness_command_topic: this.baseTopic+'brightness_command',
            brightness_scale: 100,
            availability_topic: this.baseTopic+'status',
            payload_available: 'online',
            payload_not_available: 'offline',
            unique_id: this.config.id,
            device: this.deviceData
        }

        debugDiscovery('Home Assistant config topic: '+configTopic)
        debugDiscovery(discoveryData)
        this.publishMqtt(configTopic, JSON.stringify(discoveryData))
    }
}

module.exports = SimpleDimmer