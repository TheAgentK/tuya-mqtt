const convert = require('color-convert');
const debug = require('debug')('TuyaColor');

/**
 * Class to calculate settings for Tuya colors
 */
function TuyaColorLight() {

    this.colorMode = 'white'; // or 'colour'
    this.brightness = 100; // percentage value use _convertValToPercentage functions below.

    this.color = {
        H: 130,
        S: 100,
        L: 50
    };

    this.hue = this.color.H;
    this.saturation = this.color.S;
    this.lightness = this.color.L;

    this.colorTemperature = 255;
    this.colorTempMin = 153;
    this.colorTempMax = 500;

    this.dps = {};
}

/**
 * calculate color value from given percentage
 * @param  {Integer} percentage 0-100 percentage value
 * @returns {Integer} color value from 0-255
 */
TuyaColorLight.prototype._convertPercentageToVal = function (percentage) {
    var tmp = Math.round(255 * (percentage / 100));
    debug('Converted ' + percentage + ' to: ' + tmp);
    return tmp;
};

/**
 * calculate percentage from color value
 * @param  {Integer} val 0-255 color value
 * @returns {Integer} HK-Value
 */
TuyaColorLight.prototype._convertValToPercentage = function (val) {
    var tmp = Math.round((val / 255) * 100);
    debug('Converted ' + val + ' to: ' + tmp);
    return tmp;
};

/**
 * converts color value to color temperature
 * @param  {Integer} val
 * @returns {Integer} percentage from 0-100
 */
TuyaColorLight.prototype._convertColorTemperature = function (val) {
    var tmpRange = this.colorTempMax - this.colorTempMin;
    var tmpCalc = Math.round((val / this.colorTempMax) * 100);

    debug('HK colorTemp Value: ' + val);
    debug('HK colorTemp scale min : ' + this.colorTempMin);
    debug('HK colorTemp scale max : ' + this.colorTempMax);
    debug('HK colorTemp range (tmpRange): ' + tmpRange);
    debug('HK colorTemp % tmpCalc: ' + tmpCalc);

    var tuyaColorTemp = this._convertPercentageToVal(tmpCalc);

    debug('HK tuyaColorTemp: ' + tuyaColorTemp);

    return tuyaColorTemp;
};

/**
 * Convert color temperature to HK
 * @param  {Integer} val
 * @returns {Integer} HK-Value
 */
TuyaColorLight.prototype._convertColorTemperatureToHK = function (val) {

    var tuyaColorTempPercent = this._convertValToPercentage(this.colorTemperature);
    var tmpRange = this.colorTempMax - this.colorTempMin;
    var tmpCalc = Math.round((tmpRange * (tuyaColorTempPercent / 100)) + this.colorTempMin);
    var hkValue = Math.round(tmpCalc);

    debug('Tuya color Temperature : ' + val);
    debug('Tuya color temp Percent of 255: ' + tuyaColorTempPercent + '%');

    debug('HK colorTemp scale min : ' + this.colorTempMin);
    debug('HK colorTemp scale max : ' + this.colorTempMax);

    debug('HK Color Temp Range: ' + tmpRange);
    debug('HK range %: ' + tuyaColorTempPercent);
    debug('HK Value: ' + hkValue);

    return hkValue;
};

/**
 * check if given String is HEX
 * @param  {String} h
 * @returns {boolean}
 */
TuyaColorLight.prototype._ValIsHex = function (h) {
    debug("Check if value is hex", h);
    return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(h)
};

/**
 * get AlphaHex from percentage brightness
 * @param  {Integer} brightness
 * @return {string} brightness as HEX value
 */
TuyaColorLight.prototype._getAlphaHex = function (brightness) {
    var i = brightness / 100;
    var alpha = Math.round(i * 255);
    var hex = (alpha + 0x10000).toString(16).substr(-2);
    var perc = Math.round(i * 100);

    debug('alpha percent: ' + perc + '% hex: ' + hex + ' alpha: ' + alpha);
    return hex;
};

/**
 * Set saturation from value
 * @param  {Integer} value
 */
TuyaColorLight.prototype.setSaturation = function (value) {
    this.color.S = value;
    this.saturation = value;
    this.colorMode = 'colour';

    debug('SET SATURATION: ' + value);
};

/**
 * Set Brightness
 * @param  {Integer} value
 */
TuyaColorLight.prototype.setBrightness = function (value) {
    this.brightness = value;
    var newValue = this._convertPercentageToVal(value);
    debug("BRIGHTNESS from UI: " + value + ' Converted from 100 to 255 scale: ' + newValue);
}

/**
 * @param  {} value
 */
TuyaColorLight.prototype.setHue = function (value) {
    debug('SET HUE: ' + value);
    debug('Saturation Value: ' + this.color.S);
    this.color.H = value;

    //check color and set colormode if necessary
    debug("colormode", value, this.color.S);
    if (value === 0 && this.color.S === 0) {
        this.colorMode = 'white';
        debug('SET Color Mode: \'white\'');
    } else {
        this.colorMode = 'colour';
        debug('SET Color Mode: \'colour\' -- dahhhhhh british spelling \'coulour\' really is annoying... why you gotta be special?');
    }


    return {
        color: this.color,
        colorMode: this.colorMode,
        hue: this.color.H,
        saturation: this.saturation
    };
};

/**
 * Set HSL color
 * @param  {Integer} hue
 * @param  {Integer} saturation
 * @param  {Integer} brightness
 */
TuyaColorLight.prototype.setHSL = function (hue, saturation, brightness) {
    this.setSaturation(saturation);
    this.setBrightness(brightness);
    this.setHue(hue);
}

/**
 * Set color from given string
 * @param  {String} colorValue could be HEX or HSL color type
 * @returns {Object} dps settings for given color
 */
TuyaColorLight.prototype.setColor = function (colorValue) {
    debug("Recieved color", colorValue);

    if (this._ValIsHex(colorValue)) {
        debug("Color is Hex");
        var color = convert.hex.hsl(colorValue);
    } else {
        debug("Color is HSL");
        var color = colorValue.split(",");
        // convert strings to numbers
        color.forEach(function (element, key) {
            color[key] = parseInt(element, 10);
        });
    }
    debug("Converted color as HSL", {
        0: color[0] + " - " + typeof color[0],
        1: color[1] + " - " + typeof color[1],
        2: color[2] + " - " + typeof color[2]
    })

    this.setHSL(color[0], color[1], color[2]);
    return this.getDps();
}

/**
 * get dps settings for current color
 * @returns {Object} dps settings
 */
TuyaColorLight.prototype.getDps = function () {
    var color = this.color;

    var lightness = Math.round(this.brightness / 2);
    var brightness = this.brightness;
    var apiBrightness = this._convertPercentageToVal(brightness);
    var alphaBrightness = this._getAlphaHex(brightness);

    var hexColor1 = convert.hsl.hex(color.H, color.S, lightness);

    var hexColor2 = convert.hsl.hex(0, 0, lightness);

    var colorTemperature = this.colorTemperature;

    var lightColor = (hexColor1 + hexColor2 + alphaBrightness).toLowerCase();

    var temperature = (this.colorMode === 'colour') ? 255 : this._convertColorTemperature(colorTemperature);

    dpsTmp = {
        '1': true,
        '2': this.colorMode,
        '3': apiBrightness,
        '4': temperature,
        '5': lightColor
        // '6' : hexColor + hexColor + 'ff'
    };
    debug("dps", dpsTmp);
    return dpsTmp;
}

module.exports = TuyaColorLight;