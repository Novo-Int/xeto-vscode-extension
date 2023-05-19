"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSymbols = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const isProtoArray = (p) => {
    try {
        return Object.keys(p.children)
            .map((key) => parseInt(key.substring(1)))
            .every((k) => isNaN(k) === false);
    }
    catch {
        return false;
    }
};
const getSymbolType = (p) => {
    if (p.name === "of" || p.name === "is") {
        return vscode_languageserver_1.SymbolKind.Operator;
    }
    if (p.type === "sys.Marker" ||
        p.type === "Marker" ||
        p.refType?.type === "sys.Maker" ||
        p.refType?.type === "Marker") {
        return vscode_languageserver_1.SymbolKind.Constant;
    }
    if (p.name === "Bool" ||
        p.refType?.name === "Bool" ||
        p.type === "Bool" ||
        p.type === "sys.Bool" ||
        (p.type === "sys.Maybe" &&
            p.children["_of"] &&
            p.children["_of"].type === "Bool")) {
        return vscode_languageserver_1.SymbolKind.Boolean;
    }
    if (p.name === "Str" ||
        p.refType?.name === "Str" ||
        p.type === "Str" ||
        p.type === "sys.Str" ||
        (p.type === "sys.Maybe" &&
            p.children["_of"] &&
            p.children["_of"].type === "Str")) {
        return vscode_languageserver_1.SymbolKind.String;
    }
    if (p.name === "Number" ||
        p.refType?.name === "Number" ||
        p.type === "Number" ||
        p.type === "sys.Number" ||
        (p.type === "sys.Maybe" &&
            p.children["_of"] &&
            p.children["_of"].type === "Number")) {
        return vscode_languageserver_1.SymbolKind.Number;
    }
    if (p.name === "None" ||
        p.refType?.name === "None" ||
        p.type === "None" ||
        p.type === "sys.None") {
        return vscode_languageserver_1.SymbolKind.Null;
    }
    if (Object.keys(p.children).length === 0) {
        return vscode_languageserver_1.SymbolKind.Property;
    }
    //  maybe it's an array
    if (isProtoArray(p)) {
        return vscode_languageserver_1.SymbolKind.Array;
    }
    return vscode_languageserver_1.SymbolKind.Namespace;
};
const generateSymbols = (root) => {
    const ret = [];
    const symbols = root.children;
    Object.keys(symbols).forEach((symbolName) => {
        const loc = symbols[symbolName].loc;
        if (!loc || !loc.line || !loc.col) {
            return;
        }
        const docSymbol = {
            name: symbolName.replace(/_(.*)/, "$1"),
            kind: getSymbolType(symbols[symbolName]),
            range: {
                start: {
                    line: loc.line,
                    character: loc.col,
                },
                end: {
                    line: loc.line,
                    character: loc.col + symbols[symbolName].name.length,
                },
            },
            selectionRange: {
                start: {
                    line: loc.line,
                    character: loc.col,
                },
                end: {
                    line: loc.line,
                    character: loc.col + symbols[symbolName].name.length,
                },
            },
        };
        if (Object.keys(symbols[symbolName].children).length) {
            docSymbol.children = generateSymbols(symbols[symbolName]);
        }
        ret.push(docSymbol);
    });
    return ret;
};
exports.generateSymbols = generateSymbols;
//# sourceMappingURL=index.js.map