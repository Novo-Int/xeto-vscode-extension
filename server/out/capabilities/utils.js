"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProtoFromFileLoc = exports.getLargestIdentifierForPosition = exports.getIdentifierLength = exports.getIdentifierForPosition = void 0;
const FindProto_1 = require("../FindProto");
const identifierCharRegexp = /[a-zA-Z0-9_. \t]/;
const identifierSegmentCharRegexp = /[a-zA-Z0-9_]/;
function getIdentifierForPosition(doc, pos) {
    let position = doc.offsetAt(pos) - 1;
    const text = doc.getText();
    // this is naive, but we go backwards until we reach a :
    let identifier = "";
    while (position >= -1 && text.charAt(position).match(identifierCharRegexp)) {
        identifier = text.charAt(position) + identifier;
        position--;
    }
    if (position === -1) {
        return "";
    }
    identifier = identifier.trim().replace(/[\n\t]/g, "");
    return identifier;
}
exports.getIdentifierForPosition = getIdentifierForPosition;
function getIdentifierLength(doc, pos) {
    let position = doc.offsetAt(pos) - 1;
    let length = 0;
    const text = doc.getText();
    while (position >= -1 &&
        text.charAt(position).match(identifierSegmentCharRegexp)) {
        position--;
        length++;
    }
    return length;
}
exports.getIdentifierLength = getIdentifierLength;
function getLargestIdentifierForPosition(doc, pos) {
    let position = doc.offsetAt(pos);
    const text = doc.getText();
    // this is naive, but we go backwards until we reach a :
    let identifier = "";
    //  eat up \n
    while (position >= -1 && text.charAt(position) === "\n") {
        position--;
    }
    while (position >= -1 && text.charAt(position).match(identifierCharRegexp)) {
        identifier = text.charAt(position) + identifier;
        position--;
    }
    identifier = identifier.trim().replace(/[\n\t]/g, "");
    position = doc.offsetAt(pos) + 1;
    while (position < text.length &&
        text.charAt(position).match(identifierSegmentCharRegexp)) {
        identifier += text.charAt(position);
        position++;
    }
    identifier = identifier.trim().replace(/[\n\t]/g, "");
    return identifier.split(".");
}
exports.getLargestIdentifierForPosition = getLargestIdentifierForPosition;
function getProtoFromFileLoc(input) {
    // let try to find the identifier for this position
    const compiledDocument = input.compiledDocs[input.uri];
    const doc = input.documents.get(input.uri);
    if (!compiledDocument || !doc) {
        return null;
    }
    const identifier = getLargestIdentifierForPosition(doc, input.pos);
    if (!identifier) {
        return null;
    }
    const proto = compiledDocument.root &&
        FindProto_1.findProtoByQname(identifier.join("."), compiledDocument.root);
    if (proto) {
        return proto;
    }
    else {
        // 	search in the files lib first
        const lib = input.compilersToLibs.get(compiledDocument);
        if (lib) {
            const proto = FindProto_1.findProtoByQname(identifier.join("."), lib.rootProto);
            if (proto) {
                return proto;
            }
        }
        const proto = input.libManager.findProtoByQName(identifier.join("."), lib?.deps);
        return proto;
    }
}
exports.getProtoFromFileLoc = getProtoFromFileLoc;
//# sourceMappingURL=utils.js.map