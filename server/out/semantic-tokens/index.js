"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertProtosToSemanticTokens = exports.extractSemanticProtos = void 0;
const FindProto_1 = require("../FindProto");
const extractSemanticProtos = (root, libManager) => {
    const bag = [];
    extractSemanticProtosRecursive(root, root, bag, libManager);
    return bag;
};
exports.extractSemanticProtos = extractSemanticProtos;
const isMarker = (root, proto, libManager) => {
    if (!proto.type) {
        return false;
    }
    if (proto.children['#isMeta']) {
        return false;
    }
    if (proto.type === 'Marker' || proto.type === 'sys.Marker' || proto.refType?.type === 'Marker' || proto.refType?.type === 'sys.Marker') {
        return true;
    }
    //	TO DO - we should be able to replace all this logic and use proto.refType
    //	to check if this points to a Marker or not
    //	maybe we have a type so we should resolve that
    const alias = FindProto_1.findProtoByQname(proto.type, root);
    if (alias) {
        if (alias.type === 'Marker' || alias.type === 'sys.Marker') {
            return true;
        }
        return false;
    }
    if (!libManager) {
        return false;
    }
    //	check in the libs
    const libAlias = libManager.findProtoByQName(proto.type);
    if (libAlias) {
        if (libAlias.type === 'Marker' || libAlias.type === 'sys.Marker') {
            return true;
        }
        return false;
    }
    return false;
};
const extractSemanticProtosRecursive = (root, proto, bag, libManager) => {
    if (isMarker(root, proto, libManager)) {
        bag.push(proto);
        return;
    }
    Object.values(proto.children).forEach(proto => extractSemanticProtosRecursive(root, proto, bag, libManager));
};
const extractPosFromProto = (proto) => {
    return {
        line: proto.loc.line,
        col: proto.loc.col - 1,
        length: proto.name.length
    };
};
const convertProtosToSemanticTokens = (protos) => {
    //	sort them based on the position on the doc
    const sortedProtos = protos.filter(p => p.loc).sort((a, b) => a.loc.charIndex - b.loc.charIndex);
    if (sortedProtos.length === 0) {
        return [];
    }
    //	created the return array based
    let prevPos = extractPosFromProto(sortedProtos[0]);
    const ret = [prevPos.line, prevPos.col, prevPos.length, 0, 0];
    for (let i = 1; i < sortedProtos.length; i++) {
        //	compute the difference
        const diff = [0, 0, 0, 0, 1];
        const currentPos = extractPosFromProto(sortedProtos[i]);
        if (currentPos.line === prevPos.line) {
            ret.push(0, currentPos.col - prevPos.col, currentPos.length, 0, 0);
        }
        else {
            ret.push(currentPos.line - prevPos.line, currentPos.col, currentPos.length, 0, 0);
        }
        prevPos = currentPos;
    }
    return ret;
};
exports.convertProtosToSemanticTokens = convertProtosToSemanticTokens;
//# sourceMappingURL=index.js.map