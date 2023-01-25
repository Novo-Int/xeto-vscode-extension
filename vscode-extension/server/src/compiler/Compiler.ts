import { CompilerError, ErrorTypes } from './Errors';
import { FileLoc } from "./FileLoc";
import { Parser } from './Parser';
import { Proto } from './Proto';

export class ProtoCompiler {
  public errs: CompilerError[] = [];

  public root?: Proto;
  public readonly sourceUri: string;

  private ast: Record<string, unknown> = {};

  public constructor(sourceUri: string) {
    this.sourceUri = sourceUri;
  }

  private isCompilerError(err: any): err is CompilerError {
    return err.type;
  }

  public logErr(err: CompilerError): void;
  public logErr(msg: string, type: ErrorTypes, where: FileLoc): void;
  public logErr(msg: string | CompilerError, type?: ErrorTypes, where?: FileLoc): void {
    if (this.isCompilerError(msg)) {
      this.errs.push(msg);
    } else {
      this.errs.push(new CompilerError(msg, type!, where!));
    }
  }

  public run(input: string) {
    const parseStep = new Parser(input, this.logErr.bind(this), this.sourceUri);
    parseStep.parse(this.ast);

    this.root = Proto.fromAST(this.ast);
  }
}