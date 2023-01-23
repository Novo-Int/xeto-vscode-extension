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

  public findChildrenOf(identifier: string): string[] {
    if (identifier.endsWith('.')) {
      identifier = identifier.slice(0, -1);
    }

    const proto = this.findProtoByQname(identifier);

    if (proto) {
      //  maybe this is an alias
      // const alias = proto.type?.resolved;

      const toRet: string[] = [];

      /*
      if (alias) {
        toRet = Object.keys(alias.children).filter(p => p.startsWith("_") === false);
      }
      */

      return [...toRet, ...Object.keys(proto.children).filter(p => p.startsWith("_") === false)];
    }

    return [];
  }

  public findProtoByQname(qname: string): Proto | undefined {
    if (!this.root) {
      return undefined;
    }

    const parts = qname === "" ? [] : qname.split(".");

    let ret: Proto | undefined;
    let currentProto: Proto = this.root;
    let currentPartIndex = 0;

    while(currentProto && currentPartIndex < parts.length) {
      const currentPart = parts[currentPartIndex++];

      currentProto = currentProto.children[currentPart];

      //  need to take into account aliases here
      //  currentProto.type;

      if (currentProto && currentPartIndex === parts.length) {
        ret = currentProto;
      }
    }

    return ret;
  }

  public run(input: string) {
    const parseStep = new Parser(input, this.logErr.bind(this));
    parseStep.parse(this.ast);

    this.root = Proto.fromAST(this.ast);
  }
}