"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Path = void 0;
const StringUtils_1 = require("./StringUtils");
class Path {
    constructor(...rest) {
        this.segments = [];
        this.segments = [...rest];
    }
    static fromString(path) {
        const segments = path.split(".");
        if (segments.some((s) => s === "" ||
            (StringUtils_1.isAlpha(s.charAt(0)) === false && s.charAt(0) !== "_") ||
            s.split("").some((l) => !StringUtils_1.isAlphaNumeric(l)))) {
            throw new Error(`Path is not valid ${path}`);
        }
        return new Path(...segments);
    }
    get name() {
        return this.segments[this.segments.length - 1];
    }
    get size() {
        return this.segments.length;
    }
    get isRoot() {
        return false;
    }
    add(segment) {
        return new Path(...this.segments, segment);
    }
    toString() {
        return this.segments.join(".");
    }
}
exports.Path = Path;
Path.root = {
    name: "",
    size: 0,
    add: (segment) => new Path(segment),
    isRoot: true,
    toString: () => '',
    //https://stackoverflow.com/questions/34523334/how-to-assign-object-literal-to-variable-with-private-properties
    ...{},
};
//# sourceMappingURL=Path.js.map