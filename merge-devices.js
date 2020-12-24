#!/usr/bin/env node
const fs = require('fs');
const json5 = require('json5');
const utils = require('./lib/utils');

// Setup Exit Handlers
process.on('exit', processExit.bind(0));
process.on('SIGINT', processExit.bind(0));
process.on('SIGTERM', processExit.bind(0));
process.on('uncaughtException', processExit.bind(1));

async function processExit(exitCode) {
    if (exitCode || exitCode === 0)
        console.error('Exit code: ' + exitCode)
    process.exit();
}

// Main code function
const main = async() => {
    const date = new Date();
    const dateTimeStr = date.getFullYear() + '-' + ("0" + (date.getMonth() + 1)).slice(-2) + '-' + ("0" + date.getDate()).slice(-2) + '_' + ("0" + date.getHours()).slice(-2) + ("0" + date.getMinutes()).slice(-2) + ("0" + date.getSeconds()).slice(-2);
    const configDevicesFilename = 'devices.conf';
    const configDevicesBackupFilename = `${configDevicesFilename}_${dateTimeStr}.bak`;
    const configNewDevicesFilename = `new-${configDevicesFilename}`;

    let configDevices;
    let configNewDevices;

    try {
        console.log(`Loading ${configNewDevicesFilename}...`);
        configNewDevices = fs.readFileSync(`./${configNewDevicesFilename}`, 'utf8');
        configNewDevices = json5.parse(configNewDevices);
    }
    catch (e) {
        console.error(`Could not parse new devices config file [${configNewDevicesFilename}]!`);
        console.error(e);
        process.exit(1);
    }

    try {
        console.log(`Loading ${configDevicesFilename}...`);
        configDevices = fs.readFileSync(`./${configDevicesFilename}`, 'utf8');
        configDevices = json5.parse(configDevices);
    }
    catch (e) {
        console.error(`Could not parse devices config file [${configDevicesFilename}]!`);
        console.error(e);
        process.exit(1);
    }

    try {
        console.log(`Backing up devices config file [${configDevicesFilename}] to [${configDevicesBackupFilename}]...`);
        fs.copyFileSync(`./${configDevicesFilename}`, `./${configDevicesBackupFilename}`);
    }
    catch (e) {
        console.error(`Could not make backup of devices config file [${configDevicesFilename}] to [${configDevicesBackupFilename}].`);
        console.error(e);
        process.exit(1);
    }

    console.log('Indexing devices...');

    // Create a dictionary for faster lookups with many devices
    const configDevicesDictionary = {};
    for (let configDevice of configDevices) {
        configDevicesDictionary[configDevice.id] = configDevice;
    }

    console.log('Merging devices...');

    // Add new devices and update existing devices
    for (let configNewDevice of configNewDevices) {
        let configDevice = configDevicesDictionary[configNewDevice.id];
        if (configDevice == null) {
            // Add new device
            console.log(`Adding device: ${configNewDevice.name} (id: ${configNewDevice.id})...`);
            configDevices.push(configNewDevice);
            configDevicesDictionary[configNewDevice.id] = configNewDevice;
            continue;
        }

        if (configDevice.allowMerge === false)
            continue; // No merge updates allowed for this device
        
        // Update existing device
        if (configDevice.name !== configNewDevice.name) {
            console.log(`Updating device name: '${configDevice.name}' to '${configNewDevice.name}' (device id: ${configDevice.key})...`);
            configDevice.name = configNewDevice.name;
        }
        if (configDevice.key !== configNewDevice.key) {
            console.log(`Updating device key for: '${configDevice.name}' (device id: ${configDevice.key})...`);
            configDevice.key = configNewDevice.key;
        }
    }

    // Sort the devices by name
    configDevices.sort((a, b) => a.name < b.name ? -1 : 1);
    const configDevicesJson = json5.stringify(configDevices, { space: '    ', quote: '"' });

    //console.log(configDevicesJson);

    try {
        console.log(`Saving devices config file [${configDevicesFilename}]...`);
        fs.writeFileSync(`./${configDevicesFilename}`, configDevicesJson, { encoding: 'utf8' });
    }
    catch (e) {
        console.error(`Could not write devices config file [${configDevicesFilename}]!`)
        console.error(e)
        process.exit(1)
    }

    console.log('Done!');
}

// Call the main code
main();