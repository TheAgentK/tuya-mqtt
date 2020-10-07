const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya-mqtt:tuya')
const utils = require('../lib/utils')

class RGBTWLight extends TuyaDevice {
    async init() {
        await this.guessLightInfo()

        // Set device specific variables
        this.config.dpsPower = this.config.dpsPower ? this.config.dpsPower : this.guess.dpsPower
        this.config.dpsMode = this.config.dpsMode ? this.config.dpsMode : this.guess.dpsMode
        this.config.dpsWhiteValue = this.config.dpsWhiteValue ? this.config.dpsWhiteValue : this.guess.dpsWhiteValue
        this.config.whiteValueScale = this.config.whiteValueScale ? this.config.whiteValueScale : this.guess.whiteValueScale
        this.config.dpsColorTemp = this.config.dpsColorTemp ? this.config.dpsColorTemp : this.guess.dpsColorTemp
        this.config.dpsColor = this.config.dpsColor ? this.config.dpsColor : this.guess.dpsColor
        this.config.colorType = this.config.colorType ? this.config.colorType : this.guess.colorType
        this.config.colorType = 'hsb'

        this.deviceData.mdl = 'RGBTW Light'

        this.isRgbtwLight = true

        // Map generic DPS topics to device specific topic names
        this.deviceTopics = {
            state: {
                key: this.config.dpsPower,
                type: 'bool'
            },
            white_value_state: { 
                key: this.config.dpsWhiteValue,
                type: 'int',
                min: 1,
                max: 100,
                scale: this.config.whiteValueScale,
                stateMath: (this.config.whiteValueScale == 1000) ? '/10' : '/2.55',
                commandMath: (this.config.whiteValueScale == 1000) ? '*10' : '*2.55'
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
            hsb_state: {
                key: this.config.dpsColor,
                type: this.config.colorType,
                components: 'h,s,b'
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
            brightness_scale: 100,
            hs_state_topic: this.baseTopic+'hs_state',
            hs_command_topic: this.baseTopic+'hs_command',
            white_value_state_topic: this.baseTopic+'white_value_state',
            white_value_command_topic: this.baseTopic+'white_value_command',
            white_value_scale: 100,
            unique_id: this.config.id,
            device: this.deviceData
        }

        debug('Home Assistant config topic: '+configTopic)
        debug(discoveryData)
        this.publishMqtt(configTopic, JSON.stringify(discoveryData))
    }

    async guessLightInfo() {
        this.guess = new Object()
        let mode = await this.device.get({"dps": 2})
        if (mode && (mode === 'white' || mode === 'colour')) {
            this.guess.dpsPower = 1
            this.guess.dpsMode = 2
            this.guess.dpsWhiteValue = 3
            this.guess.whiteValueScale = 255
            const colorTemp = await this.device.get({"dps": 4})
            if (colorTemp) { 
                this.guess.dpsColorTemp = 4
            } else {
                this.guess.dpsColorTemp = 0
            }
            this.guess.dpsColor = 5
            const color = await this.device.get({"dps": this.guess.dpsColor})
            this.guess.colorType = (color && color.length === 14) ? 'hsbhex' : 'hsb'
        } else {
            mode = await this.device.get({"dps": 20})
            this.guess.dpsPower = 20
            this.guess.dpsMode = 21
            this.guess.dpsWhiteValue = 22
            this.guess.whiteValueScale = 1000
            const colorTemp = await this.device.get({"dps": 23})
            if (colorTemp) { 
                this.guess.dpsColorTemp = 23
            } else {
                this.guess.dpsColorTemp = 0
            }
            this.guess.dpsColor = 24
            const color = await this.device.get({"dps": this.guess.dpsColor})
            this.guess.colorType = (color && color.length === 12) ? 'hsb' : 'hsbhex'
        }
    }
}

module.exports = RGBTWLight