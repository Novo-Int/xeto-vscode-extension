import { ProtoCompiler } from "../Compiler";
import { CLib, CProto } from "../CTypes";
import { CompilerError, ErrorTypes } from '../Errors';
import { FileLoc } from '../FileLoc';
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
    return this.compiler!.libs;
  }

  public run(): void {}

  //ProtoEnv env() { compiler.env }

  //Str[] libNames() { compiler.libNames }

  //CLib[] libs() { compiler.libs }

  //CProto root() { compiler.root }

  //CSys sys() { compiler.sys }

  //MProtoSpace ps() { compiler.ps }

  public addSlot(parent: CProto, child: CProto): void {
    if (child.parent !== undefined)
      throw Error("Adding a parent to a proto that has a parent");
    child.parent = parent;

    if (parent.children[child.name] != null) {
      const length = child.name.length;

      const existingLoc = parent.children[child.name].loc;
      const newLoc = child.loc;

      const firstError = new CompilerError(`Duplicate slot name ${child.name} at ${FileLoc.newWithOffset(newLoc, 1).toString()}`,
        ErrorTypes.DUPLICATED_SYMBOL,
        existingLoc,
        {...existingLoc, col: existingLoc.col + length});
      const secondError = new CompilerError(`Duplicate slot name ${child.name} at ${FileLoc.newWithOffset(existingLoc, 1).toString()}`,
        ErrorTypes.DUPLICATED_SYMBOL,
        newLoc,
        {...newLoc, col: newLoc.col + length});
      this.compiler.logErr(firstError);
      this.compiler.logErr(secondError);
    }

    parent.children[child.name] = child;
  }

  // Void info(Str msg) { compiler.info(msg) }

  // CompilerErr err(Str msg, FileLoc loc, Err? err := null) { compiler.err(msg, loc, err) }

  // CompilerErr err2(Str msg, FileLoc loc1, FileLoc loc2, Err? err := null) { compiler.err2(msg, loc1, loc2, err) }

  // Void bombIfErr() { if (!compiler.errs.isEmpty) throw compiler.errs.first }
}
