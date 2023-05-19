"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCompilerError = exports.isPartOfLib = exports.VARS = void 0;
exports.VARS = {
    env: "BROWSER",
};
exports.isPartOfLib = async (path, connection) => {
    if (exports.VARS.env === "BROWSER") {
        const split = path.split("/");
        return connection.sendRequest("xfs/exists", {
            path: [...[...split].slice(0, -1), "lib.xeto"].join("/"),
        });
    }
    else {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
            const osPath = await Promise.resolve().then(() => __importStar(require("path")));
            const stat = await fs.stat(osPath.join(path.replace("file:/", ""), "..", "lib.xeto"));
            if (stat.isFile()) {
                return true;
            }
        }
        catch {
            return false;
        }
        return false;
    }
};
exports.isCompilerError = (error) => {
    return "type" in error;
};
//# sourceMappingURL=utils.js.map