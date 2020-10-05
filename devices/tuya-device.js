const TuyAPI = require('tuyapi')
const utils = require('../lib/utils')
const debug = require('debug')('tuya-mqtt:tuya')
const debugMqtt = require('debug')('tuya-mqtt:mqtt')
const debugError = require('debug')('tuya-mqtt:error')

class TuyaDevice {
    constructor(deviceInfo) {
        this.config = deviceInfo.configDevice
        this.mqttClient = deviceInfo.mqttClient
        this.topic = deviceInfo.topic

        // Build TuyAPI device options from device config info
        this.options = {
            id: this.config.id,
            key: this.config.key
        }
        if (this.config.name) { this.options.name = this.config.name.toLowerCase().replace(/ /g,'_') }
        if (this.config.ip) { 
            this.options.ip = this.config.ip
            if (this.config.version) {
                this.options.version = this.config.version
            } else {
                this.options.version = '3.1'
            }
        }

        // Set default device data for Home Assistant device registry
        // Values may be overridden by individual devices
        this.deviceData = { 
            ids: [ this.config.id ],
            name: (this.config.name) ? this.config.name : this.config.id,
            mf: 'Tuya'
        }

        // Objects to hold cached device state data
        this.state = {
            "dps": {},
            "color": {'h': 0, 's': 0, 'b': 0}
        }

        // Property to hold friendly topics template
        this.deviceTopics = {}

        // Build the MQTT topic for this device (friendly name or device id)
        if (this.options.name) {
            this.baseTopic = this.topic + this.options.name + '/'
        } else {
            this.baseTopic = this.topic + this.options.id + '/'
        }        

        // Create the new Tuya Device
        this.device = new TuyAPI(JSON.parse(JSON.stringify(this.options)))

        // Listen for device data and call update DPS function if valid
        this.device.on('data', (data) => {
            if (typeof data == 'string') {
                debug('Data from device not encrypted:', data.replace(/[^a-zA-Z0-9 ]/g, ''))
            } else {
                debug('Data from device '+this.options.id+' ->', data.dps)
                this.updateState(data)
            }
        })

        // Find device on network
        debug('Search for device id '+this.options.id)
        this.device.find().then(() => {
            debug('Found device id '+this.options.id)
            // Attempt connection to device
            this.device.connect()
        })

        // On connect perform device specific init
        this.device.on('connected', () => {
            debug('Connected to device ' + this.toString())
            this.init()
        })

        // On disconnect perform device specific disconnect
        this.device.on('disconnected', () => {
            this.connected = false
            debug('Disconnected from device ' + this.toString())
        })

        // On connect error call reconnect
        this.device.on('error', (err) => {
            debugError(err)
            if (err.message === 'Error from socket') {
                this.reconnect()
            }
        })
    }

    // Update dps properties with device data updates
    updateState(data) {
        if (typeof data.dps != 'undefined') {
            // Update cached device state data
            for (let key in data.dps) {
                this.state.dps[key] = {
                    'val': data.dps[key],
                    'updated': true
                }
                if (this.config.dpsColor && this.config.dpsColor == key) {
                    this.updateColorState(data.dps[key])
                }
            }
            if (this.connected) {
                this.publishTopics()
            }
        }
    }

    // Publish device specific state topics
    publishTopics() {
        // Don't publish if device is not connected
        if (!this.connected) return

        // Loop through and publish all device specific topics
        for (let topic in this.deviceTopics) {
            const deviceTopic = this.deviceTopics[topic]
            const key = deviceTopic.key
            if (this.state.dps[key] && this.state.dps[key].updated) {
                const state = this.getTopicState(deviceTopic, this.state.dps[key].val)
                if (state) { 
                    this.publishMqtt(this.baseTopic + topic, state, true)
                }
            }
        }

        // Publish Generic Dps Topics
        this.publishDpsTopics()
    }

    // Publish all dps-values to topic
    publishDpsTopics() {
        try {
            if (!Object.keys(this.state.dps).length) { return }

            const dpsTopic = this.baseTopic + 'dps'
            // Publish DPS JSON data if not empty
            let data = {}
            for (let key in this.state.dps) {
                if (this.state.dps[key].updated) {
                    data[key] = this.state.dps[key].val
                }
            }
            data = JSON.stringify(data)
            const dpsStateTopic = dpsTopic + '/state'
            debugMqtt('MQTT DPS JSON: ' + dpsStateTopic + ' -> ', data)
            this.publishMqtt(dpsStateTopic, data, false)

            // Publish dps/<#>/state value for each device DPS
            for (let key in this.state.dps) {
                if (this.state.dps[key].updated) {
                    const dpsKeyTopic = dpsTopic + '/' + key + '/state'
                    const data = this.state.dps.hasOwnProperty(key) ? this.state.dps[key].val.toString() : 'None'
                    debugMqtt('MQTT DPS'+key+': '+dpsKeyTopic+' -> ', data)
                    this.publishMqtt(dpsKeyTopic, data, false)
                    this.state.dps[key].updated = false
                }
            }
        } catch (e) {
            debugError(e);
        }
    }
    
    // Get the friendly topic state based on DPS value type
    getTopicState(deviceTopic, value) {
        let state
        switch (deviceTopic.type) {
            case 'bool':
                state = value ? 'ON' : 'OFF'
                break;
            case 'int':
            case 'float':
                state = value ? value.toString() : ''
                break;
            case 'hsb':
            case 'hsbhex':
                // Return comma separate array of component values for specific topic
                state = new Array()
                const components = deviceTopic.components.split(',')
                for (let i in components) {
                    state.push(this.state.color[components[i]])
                }
                state = (state.join(','))
                break;
            case 'str':
                state = value ? value : ''
        }
        return state
    }
    
    // Process MQTT commands for all command topics at device level
    async processCommand(message, commandTopic) {
        const command = this.getCommandFromMessage(message)
        if (commandTopic === 'command' && command === 'get-states') {
            // Handle "get-states" command to update device state
            debug('Received command: ', command)
            await this.getStates()
        } else {
            // Call device specific command topic handler
            this.processDeviceCommand(message, commandTopic) 
        }
    }   

    // Process MQTT commands for all command topics at device level
    processDeviceCommand(message, commandTopic) {
        // Determine state topic from command topic to find proper template
        const stateTopic = commandTopic.replace('command', 'state')
        const deviceTopic = this.deviceTopics.hasOwnProperty(stateTopic) ? this.deviceTopics[stateTopic] : ''

        if (deviceTopic) {
            debug('Device '+this.options.id+' received command topic: '+commandTopic+', message: '+message)
            const command = this.getCommandFromMessage(message)
            let setResult = this.setTuyaState(command, deviceTopic)
            if (!setResult) {
                debug('Command topic '+this.baseTopic+commandTopic+' received invalid value: '+command)
            }
        } else {
            debug('Invalid command topic '+this.baseTopic+commandTopic+' for device: '+this.config.name)
            return
        }
    }

    // Converts message to TuyAPI JSON commands
    getCommandFromMessage(message) {
        let command

        if (message != '1' && message != '0' && utils.isJsonString(message)) {
            debugMqtt('MQTT message is JSON')
            command = JSON.parse(message);
        } else {
            switch(message.toLowerCase()) {
                case 'on':
                case 'off':
                case '0':
                case '1':
                case 'true':
                case 'false':
                    // convert simple messages (on, off, 1, 0) to TuyAPI commands
                    command = {
                        set: (message.toLowerCase() === 'on' || message === '1' || message === 'true' || message === 1) ? true : false
                    }
                    break;
                default:
                    command = message.toLowerCase()
            }
        }
        return command
    }

    // Process Tuya JSON commands via DPS command topic
    processDpsCommand(message) {
        if (utils.isJsonString(message)) {
            const tuyaCommand = this.getCommandFromMessage(message)
            debugMqtt('Received command: '+tuyaCommand)
            this.set(tuyaCommand)
        } else {
            debugError('DPS command topic requires Tuya style JSON value')
        }
    }

    // Process text base Tuya command via DPS key command topics
    processDpsKeyCommand(message, dpsKey) {
        if (utils.isJsonString(message)) {
            debugError('Individual DPS command topics do not accept JSON values')
        } else {
            const dpsMessage = this.parseDpsMessage(message)
            debugMqtt('Received command for DPS'+dpsKey+': ', message)
            const tuyaCommand = {
                dps: dpsKey,
                set: dpsMessage
            }
            this.set(tuyaCommand)
        }
    }

    // Parse string message into boolean and number types
    parseDpsMessage(message) {
        if (typeof message === 'boolean' ) {
            return message;
        } else if (message === 'true' || message === 'false') {
            return (message === 'true') ? true : false
        } else if (!isNaN(message)) {
            return Number(message)
        } else {
            return message
        }
    }

    // Get and update state of all dps properties for device
    async getStates() {
        // Suppress topic updates while syncing state
        this.connected = false
        for (let topic in this.deviceTopics) {
            const key = this.deviceTopics[topic].key
            const result = await this.device.get({"dps": key})
        }
        this.connected = true
        // Force topic update now that all states are fully in sync
        this.publishTopics()
    }

    // Set state based on command topic
    setTuyaState(command, deviceTopic) {
        const tuyaCommand = new Object()
        tuyaCommand.dps = deviceTopic.key
        switch (deviceTopic.type) {
            case 'bool':
                if (command === 'toggle') {
                    tuyaCommand.set = !this.state.dps[tuyaCommand.dps].val
                } else {
                    if (typeof command.set === 'boolean') {
                        tuyaCommand.set = command.set
                    } else {
                        tuyaCommand.set = '!!!INVALID!!!'
                    }
                }
                break;
            case 'int':
            case 'float':
                if (isNaN(command)) {
                    tuyaCommand.set = '!!!INVALID!!!'
                } else if (deviceTopic.hasOwnProperty('min') && deviceTopic.hasOwnProperty('max')) {
                    if (command >= deviceTopic.min && command <= deviceTopic.max ) {
                        tuyaCommand.set = deviceTopic.type === 'int' ? parseInt(command) : parseFloat(command)
                    } else {
                        tuyaCommand.set = '!!!INVALID!!!'
                    }
                } else {
                    tuyaCommand.set = deviceTopic.type === 'int' ? parseInt(command) : parseFloat(command)
                }
                break;
            case 'hsb':
                this.updateSetColorState(command, deviceTopic.components)
                tuyaCommand.set = this.getTuyaHsbColor()
                break;
            case 'hsbhex':
                this.updateSetColorState(command, deviceTopic.components)
                tuyaCommand.set = this.getTuyaHsbHexColor()
                break;
        }
        if (tuyaCommand.set === '!!!INVALID!!!') {
            return false
        } else {
            if (this.isRgbtwLight) {
                this.setLight(deviceTopic, tuyaCommand)
            } else {
                this.set(tuyaCommand)
            }
            return true
        }
    }
    
    // Takes Tuya color value in HSB or HSBHEX format and
    // updates cached HSB color state for device
    updateColorState(value) {
        let h, s, b
        if (this.config.colorType === 'hsbhex') {
            [, h, s, b] = (value || '0000000000ffff').match(/^.{6}([0-9a-f]{4})([0-9a-f]{2})([0-9a-f]{2})$/i) || [0, '0', 'ff', 'ff'];
            this.state.color.h = parseInt(h, 16)
            this.state.color.s = Math.round(parseInt(s, 16) / 2.55)  // Convert saturation to 100 scale
            this.state.color.b = Math.round(parseInt(b, 16) / .255) // Convert brightness to 1000 scale
        } else {
            [, h, s, b] = (value || '000003e803e8').match(/^([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})$/i) || [0, '0', '3e8', '3e8']
            // Convert from Hex to Decimal and cache values
            this.state.color.h = parseInt(h, 16)
            this.state.color.s = Math.round(parseInt(s, 16) / 10)   // Convert saturation to 100 Scale
            this.state.color.b = parseInt(b, 16)                    // Convert brightness to 1000 scale
        }

        // Initialize the set color values for first time.  Used to conflicts 
        // when mulitple HSB components are updated in quick succession
        if (!this.state.setColor) {
            this.state.setColor = {
                'h': this.state.color.h,
                's': this.state.color.s,
                'b': this.state.color.b
            }
        }
    }

    // Updates the set color values based on received value from command topics
    // This is used to cache set color values when mulitple HSB components use
    // different topics and updates come in quick succession 
    updateSetColorState(value, components) {
        // Update any HSB component with a changed value
        components = components.split(',')
        const values = value.split(',')
        for (let i in components) {
            this.state.setColor[components[i]] = Math.round(values[i])
        }
    }

    // Returns Tuya HSB format value from current setColor HSB value
    getTuyaHsbColor() {
        // Convert new HSB color to Tuya style HSB format
        let {h, s, b} = this.state.setColor
        const hexColor = h.toString(16).padStart(4, '0') + (10 * s).toString(16).padStart(4, '0') + (b).toString(16).padStart(4, '0')
        return hexColor
    }

    // Returns Tuya HSBHEX format value from current setColor HSB value
    getTuyaHsbHexColor() {
        let {h, s, b} = this.state.setColor
        const hsb = h.toString(16).padStart(4, '0') + Math.round(2.55 * s).toString(16).padStart(2, '0') + Math.round(b * .255).toString(16).padStart(2, '0');
        h /= 60;
        s /= 100;
        b *= .255;
        const
            i = Math.floor(h),
            f = h - i,
            p = b * (1 - s),
            q = b * (1 - s * f),
            t = b * (1 - s * (1 - f)),
            rgb = (() => {
                switch (i % 6) {
                    case 0:
                        return [b, t, p];
                    case 1:
                        return [q, b, p];
                    case 2:
                        return [p, b, t];
                    case 3:
                        return [p, q, b];
                    case 4:
                        return [t, p, b];
                    case 5:
                        return [b, p, q];
                }
            })().map(c => Math.round(c).toString(16).padStart(2, '0')),
            hex = rgb.join('');

        return hex + hsb;
    }

    // Set white/colour mode based on target mode
    async setLight(topic, command) {
        const currentMode = this.state.dps[this.config.dpsMode].val
        let targetMode = undefined
        if (topic.key === this.config.dpsWhiteValue) {
            // If setting white level, light should be in white mode
            targetMode = 'white'
        } else if (topic.key === this.config.dpsColor) {
            if (this.state.setColor.s === 0 && this.state.setColor.s !== this.state.color.s) {
                // If setting saturation to 0 and not already zero, target mode is 'white'
                targetMode = 'white'
            } else if ((this.state.setColor.s > 0 && this.state.setColor.s !== this.state.color.s) || 
                        this.state.setColor.h !== this.state.color.h || 
                        this.state.setColor.b !== this.state.color.b) {
                // If setting saturation > 0, or changing any other color value, target mode is 'colour'
                targetMode = 'colour'
            }
        }
        // If mode change required, add it to the set command
        if (targetMode && currentMode !== targetMode) {
            command = {
                multiple: true,
                data: {
                    [command.dps]: command.set,
                    [this.config.dpsMode]: targetMode
                }
            }
        }
        this.set(command)
    }

    // Simple function to help debug output 
    toString() {
        return this.config.name+' (' +(this.options.ip ? this.options.ip+', ' : '')+this.options.id+', '+this.options.key+')'
    }

    set(command) {
        debug('Set device '+this.options.id+' -> '+JSON.stringify(command))
        return new Promise((resolve, reject) => {
            this.device.set(command).then((result) => {
                resolve(result)
            })
        })
    }

    // Retry connection every 10 seconds if unable to connect
    async reconnect() {
        debug('Error connecting to device id '+this.options.id+'...retry in 10 seconds.')
        await utils.sleep(10)
        if (this.connected) { return }
        debug('Search for device id '+this.options.id)
        this.device.find().then(() => {
            debug('Found device id '+this.options.id)
            // Attempt connection to device
            this.device.connect()
        })
    }
    

    // Publish MQTT
    publishMqtt(topic, message, isDebug) {
        if (isDebug) { debugMqtt(topic, message) }
        this.mqttClient.publish(topic, message, { qos: 1 });
    }
}

module.exports = TuyaDevice