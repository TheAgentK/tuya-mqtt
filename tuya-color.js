const convert = require('color-convert');
const debug = require('debug')('TuyaColor');

function TuyaColorLight(tuya) {
    this.tuya = tuya;

    this.colorMode = 'white';
    this.brightness = 100; // percentage value use _convertValToPercentage functions below.

    this.color = {
        H: 130,
        S: 100,
        L: 50
    };
    this.color2 = {
        H: 0,
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

TuyaColorLight.prototype._convertPercentageToVal = function (percentage) {
    var tmp = Math.round(255 * (percentage / 100));
    debug('Converted ' + percentage + ' to: ' + tmp);
    return tmp;
};

TuyaColorLight.prototype._convertValToPercentage = function (val) {
    var tmp = Math.round((val / 255) * 100);
    debug('Converted ' + val + ' to: ' + tmp);
    return tmp;
};

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
TuyaColorLight.prototype._ValIsHex = function (h) {
    debug("Check if value is hex", h);
    var a = parseInt(h, 16);
    var result = (a.toString(16) === h.toLowerCase());
    return result;
};

TuyaColorLight.prototype._getAlphaHex = function (brightness) {
    // for (var i = 1; i >= 0; i -= 0.01) {
    var i = brightness / 100;
    debug('input brightness: ' + brightness + ' and i is ' + i);
    var alpha = Math.round(i * 255);
    var hex = (alpha + 0x10000).toString(16).substr(-2);
    var perc = Math.round(i * 100);

    debug('alpha percent: ' + perc + '% hex: ' + hex + ' alpha: ' + alpha);
    return hex;
};

TuyaColorLight.prototype.setSaturation = function (value, callback) {
    var colorMode = 'colour';
    var saturation = value;
    var color = this.color;
    color.S = value;

    this.color = color;
    this.colorMode = colorMode;
    this.saturation = saturation;

    debug(' SET SATURATION: ' + value);
};

TuyaColorLight.prototype.setBrightness = function (value, callback) {
    this.brightness = value;
    var newValue = this._convertPercentageToVal(value);
    debug("BRIGHTNESS from UI: " + value + ' Converted from 100 to 255 scale: ' + newValue);
}

TuyaColorLight.prototype.setHue = function (value, callback) {
    debug('SET HUE: ' + value);
    debug('Saturation Value: ' + this.color.S);
    this.color.H = value;

    if (value === 0 && this.color.S === 0) {
        this.colorMode = 'white';
        debug('SET Color Mode: \'white\'');
    } else {
        this.colorMode = 'colour';
        debug('SET Color Mode: \'colour\' -- dahhhhhh british spelling \'coulour\' really is annoying... why you gotta be special?');
    }


    var returnVal = {};

    returnVal.color = this.color;
    returnVal.colorMode = this.colorMode;
    returnVal.hue = this.color.H;
    returnVal.saturation = this.saturation;
};

TuyaColorLight.prototype.setHSL = function (hue, saturation, brightness) {
    this.setBrightness(brightness);
    this.setSaturation(saturation);
    this.setHue(hue);
}

TuyaColorLight.prototype.setColor = function (colorValue) {
    debug("Recieved color", colorValue);

    if (this._ValIsHex(colorValue)) {
        debug("Color is Hex");
        var color = convert.hex.hsl(colorValue);
    } else {
        debug("Color is HSL");
        var color = colorValue.split(",");
    }
    debug("Converted color as HSL", color);

    this.setHSL(color[0], color[1], color[2]);
    return this.getDps();
}

TuyaColorLight.prototype.getDps = function () {
    var color = this.color;
    var color2 = this.color2;

    var lightness = Math.round(this.brightness / 2);
    var brightness = this.brightness;
    var apiBrightness = this._convertPercentageToVal(brightness);
    var alphaBrightness = this._getAlphaHex(brightness);

    var hexColorOriginal1 = convert.hsl.hex(color.H, color.S, color.L);
    var rgbColorOriginal1 = convert.hsl.rgb(color.H, color.S, color.L);

    var hexColorOriginal2 = convert.hsl.hex(0, 0, 50);
    var rgbColorOriginal2 = convert.hsl.rgb(0, 0, 50);

    var hexColor1 = convert.hsl.hex(color.H, color.S, lightness);
    var rgbColor1 = convert.hsl.rgb(color.H, color.S, lightness);

    var hexColor2 = convert.hsl.hex(0, 0, lightness);
    var rgbColor2 = convert.hsl.rgb(0, 0, lightness);

    var colorTemperature = this.colorTemperature;

    // var ww = Math.round((this.brightness * 255) / 100);

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
    debug(dpsTmp);
    return dpsTmp;
}

module.exports = TuyaColorLight;
