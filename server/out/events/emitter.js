"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
class EventBus {
    constructor() {
        this.__callbacks = {
            [1 /* EXTERNAL_LIBS_LOADED */]: new Set(),
            [0 /* SYS_LIBS_LOADED */]: new Set(),
            [2 /* WORKSPACE_SCANNED */]: new Set(),
        };
    }
    addListener(type, callback) {
        this.__callbacks[type].add(callback);
    }
    removeListener(type, callback) {
        this.__callbacks[type].delete(callback);
    }
    fire(type) {
        this.__callbacks[type].forEach((callback) => {
            try {
                callback(type);
            }
            catch (e) {
                console.log(e);
            }
        });
    }
}
exports.eventBus = new EventBus();
//# sourceMappingURL=emitter.js.map