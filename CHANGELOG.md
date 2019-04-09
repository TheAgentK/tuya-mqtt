# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [2.0.1]
### Added
- Added capability to set multiple dps values over MQTT-Command
- 
- Custom Set-Function for TuyAPI-Class (added error handling for "index [1] not found" error)

### Changed
- MQTT-Topic no longer requires a device type
- Updated TuyAPI to v4.x.x

### Removed
- remove device type from topic

## [2.0.0]
### Added
- support for OH MQTT-Binding 2.4
- default QoS of 2, if not set through config.json

### Changed
- Updated TuyAPI to v3.x.x
- Constant off states after start #11

### Removed
- custom set function for TuyAPI

## [1.0.0]
### Added
- Add ability to connect to protected MQTT server
- Added seperate configuration file

### Changed
- TuyAPI repository not found

### Removed