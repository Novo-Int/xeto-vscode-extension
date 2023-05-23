import { CompilerError, ErrorTypes } from "./Errors";
import { FileLoc } from "./FileLoc";
import { Parser, type TokenWithPosition } from "./Parser";
import { Proto } from "./Proto";

export class ProtoCompiler {
  public errs: CompilerError[] = [];

  public root?: Proto;
  public readonly sourceUri: string;

  public tokenBag: TokenWithPosition[] = [];

  private readonly ast: Record<string, unknown> = {};

  public constructor(sourceUri: string) {
    this.sourceUri = sourceUri;
  }

  private isCompilerError(err: any): err is CompilerError {
    return err.type;
  }

  public logErr(err: CompilerError): void;
  public logErr(msg: string, type: ErrorTypes, where: FileLoc): void;
  public logErr(
    msg: string | CompilerError,
    type: ErrorTypes = ErrorTypes.NOT_REPORTED,
    where: FileLoc = FileLoc.unknown
  ): void {
    if (this.isCompilerError(msg)) {
      this.errs.push(msg);
    } else {
      this.errs.push(new CompilerError(msg, type, where));
    }
  }

  public run(input: string): void {
    if (!input.endsWith("\0")) {
      input += "\0";
    }

    const parseStep = new Parser(input, this.logErr.bind(this), this.sourceUri);
    parseStep.parse(this.ast);

    this.root = Proto.fromAST(this.ast);
    this.tokenBag = [...parseStep.tokenBag];
  }

  public getQNameByLocation(
    location: { line: number; character: number },
    root = this.root
  ): string {
    if (root == null) {
      return "";
    }

    const childrenNames = Object.keys(root.children);

    for (let i = 0; i < childrenNames.length; i++) {
      const proto = root.children[childrenNames[i]];

      if (
        proto?.loc?.line === location.line &&
        proto?.loc?.col === location.character
      ) {
        return proto.name;
      }

      const depthName = this.getQNameByLocation(location, proto);

      if (depthName) {
        return proto.name + "." + depthName;
      }
    }

    return "";
  }
}
