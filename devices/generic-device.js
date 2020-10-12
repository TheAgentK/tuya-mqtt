const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya-mqtt:device')
const utils = require('../lib/utils')

class GenericDevice extends TuyaDevice {
    async init() {
        this.deviceData.mdl = 'Generic Device'

        // Check if custom template in device config
        if (this.config.hasOwnProperty('template')) {
            // Map generic DPS topics to device specific topic names
            this.deviceTopics = this.config.template
        } else {
            // Try to get schema to at least know what DPS keys to get initial update
            const result = await this.device.get({"schema": true})
            if (!utils.isJsonString(result)) {
                if (result === 'Schema for device not available') {
                    debug('Device id '+this.config.id+' failed schema discovery and no custom template defined')
                    debug('Cannot get initial DPS state data for device '+this.options.name+' but data updates will be publish')
                }
            }
        }

        // Get initial states and start publishing topics
        this.getStates()
    }
}

module.exports = GenericDevice