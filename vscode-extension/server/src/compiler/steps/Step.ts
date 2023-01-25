import { ProtoCompiler } from "../Compiler";
import { CLib, CProto } from "../CTypes";
import { IStep } from "./IStep";

export class Step implements IStep {
  public _compiler?: ProtoCompiler = undefined;

  public get compiler(): ProtoCompiler {
    return this._compiler!;
  }

  public set compiler(c: ProtoCompiler) {
    this._compiler = c;
  }

  protected get libs(): CLib[] {
    return [];
  }

  public run(): void {
    //
  }

  public addSlot(parent: CProto, child: CProto): void {
    //
  }
}
