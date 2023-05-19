"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnknownProtoError = exports.CompilerError = exports.ErrorTypes = void 0;
const FileLoc_1 = require("./FileLoc");
var ErrorTypes;
(function (ErrorTypes) {
    ErrorTypes["MISSING_TOKEN"] = "MISSING_TOKEN";
    ErrorTypes["UNCLOSED_STRING"] = "UNCLOSED_STRING";
    ErrorTypes["DUPLICATED_SYMBOL"] = "DUPLICATED_SYMBOL";
    ErrorTypes["UNKNOWN_SYMBOL"] = "UNKNOWN_SYMBOL";
})(ErrorTypes = exports.ErrorTypes || (exports.ErrorTypes = {}));
class CompilerError extends Error {
    constructor(message, type, loc, endLoc) {
        super(message);
        this.type = type;
        this.loc = { ...loc };
        if (endLoc) {
            this.endLoc = { ...endLoc };
        }
        else {
            this.endLoc = new FileLoc_1.FileLoc(loc.file, loc.line, loc.col + 1);
        }
    }
}
exports.CompilerError = CompilerError;
class UnknownProtoError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.UnknownProtoError = UnknownProtoError;
//# sourceMappingURL=Errors.js.map