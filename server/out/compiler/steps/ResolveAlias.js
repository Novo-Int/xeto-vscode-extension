"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveAlias = void 0;
const Step_1 = require("./Step");
class ResolveAlias extends Step_1.Step {
    run() {
        //
    }
    resolveAlias(lib) {
        if (!lib.proto) {
            return;
        }
        this.resolveProto(lib.proto);
    }
    resolveProto(proto) {
        const typeName = proto.type?.name;
        if (typeName && typeName !== "sys.Marker" && typeName !== "sys.Intersection" && typeName !== "sys.Union" && typeName !== "sys.List") {
            const ref = this.compiler.findProtoByQname(typeName);
            if (ref && proto.type) {
                // proto.type = CType.makeResolved(proto.type.loc, ref);
            }
        }
        Object.values(proto.children).forEach(c => this.resolveProto(c));
    }
}
exports.ResolveAlias = ResolveAlias;
//# sourceMappingURL=ResolveAlias.js.map