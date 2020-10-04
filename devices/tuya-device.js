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
            if (this.state.dps[key].updated) {
                const state = this.getTopicState(deviceTopic, this.state.dps[key].val)
                this.publishMqtt(this.baseTopic + topic, state, true)
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
                state = value ? value.toString() : 'None'
                break;
            case 'hsb':
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
        if (commandTopic === 'command' && command === 'get-states' ) {
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
            debug('Device '+this.options.id+' recieved command topic: '+commandTopic+', message: '+message)
            const command = this.getCommandFromMessage(message)
            let setResult = this.setState(command, deviceTopic)
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
    setState(command, deviceTopic) {
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
                if (isNaN(command)) {
                    tuyaCommand.set = '!!!INVALID!!!'
                } else if (deviceTopic.hasOwnProperty('min') && deviceTopic.hasOwnProperty('max')) {
                    tuyaCommand.set = (command >= deviceTopic.min && command <= deviceTopic.max ) ? parseInt(command) : '!!!INVALID!!!'
                } else {
                    tuyaCommand.set = parseInt(command)
                }
                break;
            case 'hsb':
                tuyaCommand.set = this.convertToTuyaHsbColor(command, deviceTopic)
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
    
    // Takes Tuya color value in HSB or HSBHEX format and updates
    // cached device HSB color state
    updateColorState(value) {
        let h, s, b
        if (this.config.colorType === 'hsbhex') {
            [, h, s, b] = (value || '0000000000ffff').match(/^.{6}([0-9a-f]{4})([0-9a-f]{2})([0-9a-f]{2})$/i) || [0, '0', 'ff', 'ff'];
        } else {
            [, h, s, b] = (value || '000003e803e8').match(/^([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})$/i) || [0, '0', '3e8', '3e8']
        }
        // Convert from Hex to Decimal and cache values
        this.state.color.h = parseInt(h, 16)
        this.state.color.s = Math.round(parseInt(s, 16) / 10)
        this.state.color.b = parseInt(b, 16)        
    }

    // Takes provided decimal HSB components from MQTT topic, combines with any
    // cached (unchanged) component values and converts to Tuya HSB format
    convertToTuyaHsbColor(value, topic) {
        // Start with cached color values
        const newColor = this.state.color

        // Update any HSB component with a changed value
        const components = topic.components.split(',')
        const values = value.split(',')
        for (let i in components) {
            newColor[components[i]] = Math.round(values[i])
        }

        // Convert new HSB color to Tuya style HSB format
        const hexColor = newColor.h.toString(16).padStart(4, '0') + (10 * newColor.s).toString(16).padStart(4, '0') + (newColor.b).toString(16).padStart(4, '0')
        return hexColor
    }

    // Set white/colour mode based on target mode
    async setLight(topic, command) {
        let targetMode = undefined
        if (this.config.dpsWhiteValue === topic.key) {
            // If setting white level, light should be in white mode
            targetMode = 'white'
        } else if (this.config.dpsColor === topic.key) {
            if (this.state.color.s > 0) {
                // If setting an HSB value with saturation > 0, light should be in color mode
                targetMode = 'colour'
            } else {
                // If setting an HSB value but saturation is 0, put light in white mode
                targetMode = 'white'
            }
        }

        // Set the correct light mode
        if (targetMode && targetMode !== this.state.dps[this.config.dpsMode].val) {
            const modeCommand = {
                dps: this.config.dpsMode,
                set: targetMode
            }
            await this.set(modeCommand)
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