import { CLib, CProto } from "./CTypes";
import { CompilerError, ErrorTypes } from './Errors';
import { FileLoc } from "./FileLoc";
import { IStep, Parse, ResolveAlias } from "./steps";

export class ProtoCompiler {
  public errs: CompilerError[] = [];              // err
  //internal Duration? duration            // run
  public libs: CLib[] = [];                  // InitLibs
  public root: CProto =  new CProto(FileLoc.synthetic, "");          // Parse
  //internal CSys? sys                     // ResolveSys
  //internal MProtoSpace? ps               // Assemble
  public readonly sourceUri: string;

  public constructor(sourceUri: string) {
    this.sourceUri = sourceUri;
  }

  /*
  ProtoSpace compileSpace() {
    run(frontend).ps
  }

  ProtoSpace compileMain(Str[] outputs)
  {
    steps := frontend.dup
    outputs.each |o|
    {
      switch (o)
      {
        case "json": steps.add(GenJson())
        default: throw err("Unknown output format: $o", FileLoc.inputs)
      }
    }
    return run(steps).ps
  }*/

  private frontend(): IStep[]
  {
    return [
      //InitLibs(),
      //new Parse(),
      //ResolveSys(),
      //ResolveDepends(),
      //ExpandNested(),
      //ResolveNames(),
      //AddMeta(),
      //Inherit(),
      //Assemble(),
    ];
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
      const alias = proto.type?.resolved;

      let toRet: string[] = [];

      if (alias) {
        toRet = Object.keys(alias.children).filter(p => p.startsWith("_") === false);
      }

      return [...toRet, ...Object.keys(proto.children).filter(p => p.startsWith("_") === false)];
    }

    return [];
  }

  public findProtoByQname(qname: string): CProto | undefined {
    const parts = qname === "" ? [] : qname.split(".");

    let ret: CProto | undefined;

    this.libs.forEach(lib => {
      if (!lib.proto) {
        return;
      }

      let currentProto: CProto | undefined = lib.proto;
      let currentPartIndex = 0;

      while(currentProto && currentPartIndex < parts.length) {
        const currentPart = parts[currentPartIndex++];

        // check for alias
        let alias: CProto | undefined | null = currentProto.type?.resolved;

        while (alias) {
          currentProto = alias;
          alias = alias.type?.resolved;
        }

        currentProto = currentProto.children[currentPart];
      }

      if (currentProto && currentPartIndex === parts.length) {
        ret = currentProto;
      }
    });

    return ret;
  }

  public run(input: string) {
    const parseStep = new Parse();
    parseStep.compiler = this;
    parseStep.source = input;

    parseStep.run();

    const aliasStep = new ResolveAlias();
    aliasStep.compiler = this;
    aliasStep.run();
  }
}