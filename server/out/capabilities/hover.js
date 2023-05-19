"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addHover = void 0;
const utils_1 = require("./utils");
exports.addHover = (connection, compiledDocs, documents, compilersToLibs, libManager) => {
    function handleHover(params) {
        const proto = utils_1.getProtoFromFileLoc({
            uri: params.textDocument.uri,
            pos: params.position,
            compiledDocs,
            documents,
            compilersToLibs,
            libManager,
        });
        if (!proto) {
            return null;
        }
        return {
            contents: proto.doc || "",
        };
    }
    connection.onHover(handleHover);
};
//# sourceMappingURL=hover.js.map