"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileLoc = void 0;
class FileLoc {
    constructor(file, line = 0, col = 0, charIndex = 0) {
        this.file = file;
        this.line = line;
        this.col = col;
        this.charIndex = charIndex;
    }
    static newWithOffset(from, lineOffset = 0, colOffset = 0) {
        return new FileLoc(from.file, from.line + lineOffset, from.col + colOffset);
    }
    toString() {
        return `line: ${this.line}, col: ${this.col}`;
    }
}
exports.FileLoc = FileLoc;
FileLoc.synthetic = new FileLoc('synthetic');
FileLoc.unknown = new FileLoc('unknown');
//# sourceMappingURL=FileLoc.js.map