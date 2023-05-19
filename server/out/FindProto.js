"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRefsToProto = exports.findProtoByQname = exports.findChildrenOf = void 0;
exports.findChildrenOf = (identifier, root) => {
    if (identifier.endsWith('.')) {
        identifier = identifier.slice(0, -1);
    }
    const proto = exports.findProtoByQname(identifier, root);
    if (proto) {
        const toRet = [];
        let refType = proto.refType;
        while (refType) {
            toRet.push(...Object.keys(refType.children).filter(p => p.startsWith("_") === false).map(label => ({
                label,
                parent: refType?.name || '',
                doc: refType?.children[label].doc
            })));
            refType = refType.refType;
        }
        return [...toRet, ...Object.keys(proto.children).filter(p => p.startsWith("_") === false).map(label => ({
                label,
                parent: proto.name,
                doc: proto.children[label].doc
            }))];
    }
    return [];
};
exports.findProtoByQname = (qname, root) => {
    if (qname === "") {
        return root;
    }
    const parts = qname.split(".");
    let ret = null;
    let currentProto = root;
    let currentPartIndex = 0;
    while (currentProto && currentPartIndex < parts.length) {
        const currentPart = parts[currentPartIndex++];
        //	follow refs
        if (!currentProto.children[currentPart] && currentProto.refType) {
            currentProto = currentProto.refType.children[currentPart];
        }
        else {
            currentProto = currentProto.children[currentPart];
        }
        if (currentProto && currentPartIndex === parts.length) {
            ret = currentProto;
        }
    }
    return ret;
};
exports.findRefsToProto = (qname, root) => {
    const ret = [];
    Object.keys(root.children).forEach((key) => {
        const proto = root.children[key];
        if (proto.type?.startsWith(qname)) {
            ret.push(proto);
        }
        if (proto.children['_of']) {
            if (proto.children['_of'].type?.startsWith(qname)) {
                ret.push(proto.children['_of']);
            }
        }
        if (Object.keys(proto.children).length) {
            ret.push(...exports.findRefsToProto(qname, proto));
        }
    });
    return ret;
};
//# sourceMappingURL=FindProto.js.map