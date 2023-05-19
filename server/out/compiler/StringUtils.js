"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimToNull = exports.toCode = exports.toHex = exports.isAlphaNumeric = exports.isNumeric = exports.isLower = exports.isAlpha = void 0;
function isAlpha(str) {
    const code = str.charCodeAt(0);
    return (code >= 65 && code <= 90) || isLower(str);
}
exports.isAlpha = isAlpha;
function isLower(str) {
    const code = str.charCodeAt(0);
    return code >= 97 && code <= 122;
}
exports.isLower = isLower;
function isNumeric(str) {
    const code = str.charCodeAt(0);
    return code >= 48 && code <= 57;
}
exports.isNumeric = isNumeric;
function isAlphaNumeric(str) {
    return isAlpha(str) || isNumeric(str);
}
exports.isAlphaNumeric = isAlphaNumeric;
function toHex(str) {
    return str.charCodeAt(0).toString(16);
}
exports.toHex = toHex;
function toCode(source, quote = '"') {
    const code = source.charCodeAt(0);
    let ret = source.charAt(0);
    if (code <= 20) {
        ret = `\\u00${code.toString(16)}`;
    }
    if (quote === null || quote === undefined) {
        return ret;
    }
    return `${quote}${ret}${quote}`;
}
exports.toCode = toCode;
function trimToNull(str) {
    const ret = str.trim();
    return ret === "" ? null : ret;
}
exports.trimToNull = trimToNull;
//# sourceMappingURL=StringUtils.js.map