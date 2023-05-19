"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step = void 0;
class Step {
    constructor() {
        this._compiler = undefined;
    }
    get compiler() {
        return this._compiler;
    }
    set compiler(c) {
        this._compiler = c;
    }
    get libs() {
        return [];
    }
    run() {
        //
    }
    addSlot(parent, child) {
        //
    }
}
exports.Step = Step;
//# sourceMappingURL=Step.js.map