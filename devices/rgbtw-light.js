const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya-mqtt:tuya')
const utils = require('../lib/utils')

class RGBTWLight extends TuyaDevice {
    async init() {
        // Set device specific variables
        this.config.dpsPower = this.config.dpsPower ? this.config.dpsPower : 1
        this.config.dpsMode = this.config.dpsMode ? this.config.dpsMode : 2
        this.config.dpsWhiteValue = this.config.dpsWhiteValue ? this.config.dpsWhiteValue : 3
        this.config.whiteValueScale = this.config.whiteValueScale ? this.config.whiteValueScale : 1000
        this.config.dpsColorTemp = this.config.dpsColorTemp ? this.config.dpsColorTemp : 4
        this.config.dpsColor = this.config.dpsColor ? this.config.dpsColor : 5
        this.config.colorType = this.config.colorType ? this.config.colorType : 'hsb'

        this.deviceData.mdl = 'RGBTW Light'

        // Map generic DPS topics to device specific topic names
        this.deviceTopics = {
            state: {
                key: this.config.dpsPower,
                type: 'bool'
            },
            white_value_state: { 
                key: this.config.dpsWhiteValue,
                type: 'int',
                min: (this.config.whiteValueScale = 1000) ? 10 : 1,
                max: this.config.whiteValueScale,
                scale: this.config.whiteValueScale
            },
            hs_state: {
                key: this.config.dpsColor,
                type: this.config.colorType,
                components: 'h,s'
            },
            brightness_state: {
                key: this.config.dpsColor,
                type: this.config.colorType,
                components: 'b'
            },
            mode_state: {
                key: this.config.dpsMode,
                type: 'str'
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
            brightness_scale: 1000,
            hs_state_topic: this.baseTopic+'hs_state',
            hs_command_topic: this.baseTopic+'hs_command',
            white_value_state_topic: this.baseTopic+'white_value_state',
            white_value_command_topic: this.baseTopic+'white_value_command',
            white_value_scale: 1000,
            unique_id: this.config.id,
            device: this.deviceData
        }

        debug('Home Assistant config topic: '+configTopic)
        debug(discoveryData)
        this.publishMqtt(configTopic, JSON.stringify(discoveryData))
    }
}

module.exports = RGBTWLight