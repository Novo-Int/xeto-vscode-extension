import { findProtoByQname } from "../FindProto";
import { type LibraryManager } from "../libraries/LibManager";
import { type FileLoc } from "./FileLoc";

const metaPropsNotToParse: Record<string, boolean> = {
  _is: true,
  _loc: true,
  _doc: true,
  _val: true,
  _qnameLoc: true,
};

export class Proto {
  private _refType?: Proto;
  private _doc?: string;

  public get doc(): string | undefined {
    return this._doc;
  }

  public set doc(doc: string | undefined) {
    this._doc = doc;
  }

  public readonly name: string;
  public readonly type: string;
  public readonly loc: FileLoc;
  public qnameLoc: FileLoc | null = null;
  public initialType = "";

  //	alias link to another Proto
  public get refType(): Proto | undefined {
    return this._refType;
  }

  public get hasRefType(): boolean {
    return (
      this.type !== undefined &&
      this.type !== "sys.And" &&
      this.type !== "sys.Or" &&
      this.type !== "sys.Maybe"
    );
  }

  public children: Record<string, Proto> = {};

  constructor(name: string, type: string, loc: FileLoc, doc?: string) {
    this.name = name;
    this._doc = doc;
    this.type = type;
    this.loc = loc;
  }

  public resolveRefTypes(
    root: Proto,
    libManager: LibraryManager,
    missingRefs: Proto[]
  ): void {
    if (this.hasRefType) {
      let currentAlias = findProtoByQname(this.type, root);

      //	maybe it's from a lib
      if (currentAlias === null) {
        currentAlias = libManager.findProtoByQName(this.type);
      }

      this._refType = currentAlias ?? undefined;

      if (this._refType?.name === undefined && this.initialType === "sys.Ref") {
        missingRefs.push(this);
      }
    }

    // go deep
    Object.values(this.children).forEach((proto) => {
      proto.resolveRefTypes(root, libManager, missingRefs);
    });
  }

  private static fromPartialAST(name: string, ast: Record<string, any>): Proto {
    //	we add _ for meta names so we'll remove it here
    const originalName = name.startsWith("_") ? name.substring(1) : name;
    const proto = new Proto(
      originalName,
      ast._is || ast._val,
      ast._loc?._val,
      ast._doc?._val
    );

    proto.initialType = ast._type;

    //	it we have the start of the qname
    if (ast._qnameLoc) {
      proto.qnameLoc = ast._qnameLoc;
    }

    Object.keys(ast)
      .filter(
        (key) => !metaPropsNotToParse[key] && typeof ast[key] !== "string"
      )
      .forEach((key) => {
        const childProto = Proto.fromPartialAST(key, ast[key]);
        proto.children[key] = childProto;
      });

    return proto;
  }

  static fromAST(ast: Record<string, any>): Proto {
    const root = new Proto("root", "sys.Root", ast._loc);

    Object.keys(ast)
      .filter((key) => !metaPropsNotToParse[key])
      .forEach((key) => {
        const childProto = Proto.fromPartialAST(key, ast[key]);
        root.children[key] = childProto;
      });

    return root;
  }
}
