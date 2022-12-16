import { ProtoCompiler } from "../Compiler";
import { CProto } from "../CTypes";

export interface IStep {
    run(): void;
    addSlot(parent: CProto, child: CProto): void
    compiler: ProtoCompiler;
}
