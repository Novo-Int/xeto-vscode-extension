"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readUrl = void 0;
const node_https_1 = __importDefault(require("node:https"));
exports.readUrl = (url) => {
    const pr = new Promise((res, rej) => {
        node_https_1.default.get(url, (resp) => {
            let data = '';
            resp.on('data', chunk => {
                data += chunk;
            });
            resp.on('end', () => {
                res(data);
            });
        });
    });
    return pr;
};
//# sourceMappingURL=utils.js.map