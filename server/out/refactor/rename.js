"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renameInDoc = void 0;
const FindProto_1 = require("../FindProto");
exports.renameInDoc = (params, oldQName, doc, compiler) => {
    const edits = [];
    const refs = (compiler.root && FindProto_1.findRefsToProto(oldQName, compiler.root)) || [];
    if (refs) {
        const text = doc.getText();
        const parts = oldQName.split(".");
        parts.pop();
        parts.push(params.newName);
        const newText = parts.join(".");
        //	add the TextEdits
        for (const ref of refs) {
            if (!ref.loc) {
                continue;
            }
            const startOfReplace = text.indexOf(oldQName, ref.loc.charIndex);
            const edit = {
                range: {
                    start: doc.positionAt(startOfReplace),
                    end: doc.positionAt(startOfReplace + oldQName.length),
                },
                newText,
            };
            edits.push(edit);
        }
    }
    //  consolidate overlapping ranges
    return edits.reduce((acc, current) => {
        if (acc.find((c) => c.range.start.character === current.range.start.character &&
            c.range.start.line === current.range.start.line)) {
            return acc;
        }
        acc.push(current);
        return acc;
    }, []);
};
//# sourceMappingURL=rename.js.map