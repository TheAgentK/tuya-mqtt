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
 *  calculate color value from given brightness percentage
 * @param (Integer) percentage 0-100 percentage value
 * @returns (Integer) color value from 25 - 255
 * @private
 */
TuyaColorLight.prototype._convertBrightnessPercentageToVal = function(brt_percentage){
    // the brightness scale does not start at 0 but starts at 25 - 255
    // this linear equation is a better fit to the conversion to 255 scale
    var tmp = Math.round(2.3206*brt_percentage+22.56);
    debug('Converted brightness percentage ' + brt_percentage + ' to: ' + tmp);
    return tmp;
}

/**
 *  calculate percentage from brightness color value
 * @param brt_val 25 - 255 brightness color value
 * @returns {Integer} 0 - 100 integer percent
 * @private
 */
TuyaColorLight.prototype._convertValtoBrightnessPercentage = function(brt_val){
    var tmp = Math.round( (brt_val-22.56)/2.3206);
    debug('Converted brightness value ' + brt_val + ' to: ' + tmp);
    return tmp;
}

/**
 *  calculate color value from given saturation percentage  OR color temperature percentage
 * @param (Integer) temp_percentage 0-100 percentage value
 * @returns {Integer} saturation or color temperature value from 0 - 255
 * @private
 */
TuyaColorLight.prototype._convertSATorColorTempPercentageToVal = function(temp_percentage){
 // the saturation OR temperature scale does start at 0 - 255
 // this is a perfect linear equation fit for the saturation OR temperature scale conversion
    var tmp = Math.round(((2.5498*temp_percentage)-0.4601));
    debug('Converted saturation OR temperature percentage ' + temp_percentage + ' to: ' + tmp);
    return tmp;
}

/**
 * calculate percentage from saturation value OR color temperature value
 * @param temp_val 0 - 255 saturation or color temperature value
 * @returns {Integer} 0 - 100 integer percent
 * @private
 */
TuyaColorLight.prototype._convertValtoSATorColorTempPercentage = function(temp_val){
    var tmp = Math.round( (temp_val+0.4601/2.5498));
    debug('Converted saturation OR temperature value ' + temp_val + ' to: ' + tmp);
    return tmp;
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
 * get width Hex digits from given value
 * @param (Integer) value, decimal value to convert to hex string
 * @param (Integer) width, the number of hex digits to return
 * @returns {string} value as HEX containing (width) number of hex digits
 * @private
 */
TuyaColorLight.prototype._getHex = function (value,width){
    var hex = (value+Math.pow(16, width)).toString(16).slice(-width).toLowerCase();
    debug('value: ' + value + ' hex: ' + hex);
    return hex;
}
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
    //var newValue = this._convertPercentageToVal(value);
    var newValue = this._convertBrightnessPercentageToVal(value);
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
    //var apiBrightness = this._convertPercentageToVal(brightness);
    var apiBrightness = this._convertBrightnessPercentageToVal(brightness);

    //var alphaBrightness = this._getAlphaHex(brightness);
    var alphaBrightness = this._getHex(apiBrightness,2);

    var hexColor1 = convert.hsl.hex(color.H, color.S, lightness);

    //var hexColor2 = convert.hsl.hex(0, 0, lightness);
    var hexColor2 = this._getHex(color.H,4);
    hexColor2 = hexColor2 + this._getHex(this._convertSATorColorTempPercentageToVal(color.S),2);

    var colorTemperature = this.colorTemperature;

    var lightColor = (hexColor1 + hexColor2 + alphaBrightness).toLowerCase();

    //var temperature = (this.colorMode === 'colour') ? 255 : this._convertColorTemperature(colorTemperature);
    // color temperature percentage is at a fixed 51%
    var temperature = this._convertSATorColorTempPercentageToVal(51);

    // if the bulb is in colour mode than the dps 3 and dps 4 are ignored by the bulb but if you set it now
    // some tuya bulbs will ignore dps 5 because you set dps 3 or dps 4
    // FOR colour mode the bulb looks at dps 1, dps 2, and dps 5.
    // DPS 5 is in the following format:
    // HSL to HEX format are the leftmost hex digits (hex digits 14 - 9)
    // hex digits 8 - 5 are the HSB/HSL Hue value in HEX format
    // hex digits 4 - 3 are the HSB/HSL Saturation percentage as a value (converted to 0-255 scale) in HEX format
    // hex digits 2 - 1 are the HSB Brightness percentage as a value (converted to 25-255 scale) in HEX format

    if (this.colorMode === 'colour') {
        dpsTmp = {
            '1': true,
            '2': this.colorMode,
            //'3': apiBrightness,
            //'4': temperature,
            '5': lightColor
            // '6' : hexColor + hexColor + 'ff'
        };
        debug("dps", dpsTmp);
        return dpsTmp;
    }

    // if the bulb is in white mode then the dps 5 value is ignored by the bulb but if you set dps 5 value now
    // you may not get a response back from the bulb on the dps values
    // FOR white mode the bulb looks at dps 1, dps 2, dps 3 and dps 4
    // DPS 3 is the HSB/HSL Brightness percentage converted to a value from 25 to 255 in decimal format
    // DPS 4 is the HSB/HSL Saturation percentage converted to a value from 0 to 255 in decimal format
    if (this.colorMode === 'white'){
        dpsTmp = {
            '1': true,
            '2': this.colorMode,
            '3': apiBrightness,
            '4': temperature,
            //'5': lightColor
            // '6' : hexColor + hexColor + 'ff'
        };
        debug("dps", dpsTmp);
        return dpsTmp;
    }
}

module.exports = TuyaColorLight;