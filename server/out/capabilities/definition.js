"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDefinition = void 0;
const utils_1 = require("./utils");
exports.addDefinition = (connection, compiledDocs, documents, compilersToLibs, libManager) => {
    function handleDefinition(params) {
        const proto = utils_1.getProtoFromFileLoc({
            uri: params.textDocument.uri,
            pos: params.position,
            compiledDocs,
            documents,
            compilersToLibs,
            libManager,
        });
        if (!proto || !proto.loc) {
            return null;
        }
        return {
            uri: proto.loc.file,
            range: {
                start: {
                    line: proto.loc.line,
                    character: proto.loc.col,
                },
                end: {
                    line: proto.loc.line,
                    character: proto.loc.col + 1,
                },
            },
        };
    }
    connection.onDefinition(handleDefinition);
};
//# sourceMappingURL=definition.js.map