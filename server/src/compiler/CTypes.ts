import { Path } from "./Path";
import { type FileLoc } from "./FileLoc";
import { UnknownProtoError } from "./Errors";

export class CLib {
  readonly path: Path; // library dotted name
  readonly qname: string; // dotted qualified name
  readonly loc: FileLoc; // location of directory
  readonly source: string;
  /* const File dir      // directory which contains lib.xeto
    const File[] src    // xeto files (first is always lib.xeto)
    */
  readonly isSys: boolean; // is this the sys lib
  proto?: CProto; // proto cloned from sys.Lib
  depends?: CLib[]; // ResolveDepends
  resolvedNames = false; // ResolveNames

  // Bool isLibMetaFile(File f) { f === src.first }

  constructor(loc: FileLoc, path: Path, source: string, proto: CProto) {
    this.loc = loc;
    this.path = path;
    this.qname = path.toString();
    this.source = source;
    // this.dir   = dir
    // this.src   = src
    this.isSys = this.qname === "sys";
    this.proto = proto;
  }
}

export class CProto {
  public readonly loc: FileLoc; // ctor
  public readonly name: string; // ctor
  public pragma?: CPragma; // Parser
  public parent?: CProto; // Step.addSlot
  public children: Record<string, CProto>; // Step.addSlot
  public doc?: string; // ctor or Parser for suffix docs
  public val?: string; // ctor or Parser
  public type?: CType; // Parser or Resolve
  public isLib = false; // Parse.parseLib
  static readonly noChildren: Record<string, CProto> = {};
  private nameCounter = 0;

  public constructor(
    loc: FileLoc,
    name: string,
    doc?: string,
    type?: CType,
    val?: string
  ) {
    this.loc = loc;
    this.name = name;
    this.doc = doc;
    this.type = type;
    this.val = val;
    this.children = {};
  }

  public get(name: string, checked = true): CProto | undefined {
    const kid = this.children[name];
    if (kid) {
      return kid;
    }

    const typeKid = this.type?.get(name);
    if (typeKid != null) {
      return kid;
    }

    if (checked) throw new UnknownProtoError(`${this.qname}${name}`);

    return undefined;
  }

  public getOwn(name: string, checked = true): CProto | null {
    const kid = this.children[name];

    if (kid) return kid;
    if (checked) throw new UnknownProtoError(`${this.qname}.${name}`);

    return null;
  }

  get isRoot(): boolean {
    return this.parent === undefined;
  }

  get qname(): string {
    return this.path.toString();
  }

  get path(): Path {
    return this.isRoot ? Path.root : (this.parent?.path.add(this.name) as Path);
  }

  public isMeta(): boolean {
    return this.name[0] === "_";
  }

  public isObj(): boolean {
    return this.qname === "sys.Obj";
  }

  public isEnum(): boolean {
    return this.qname === "sys.Enum";
  }

  public isMarker(): boolean {
    return this.qname === "sys.Marker";
  }

  public isMaybe(): boolean {
    return this.qname === "sys.Maybe";
  }

  public isAnd(): boolean {
    return this.qname === "sys.And";
  }

  public isOr(): boolean {
    return this.qname === "sys.Or";
  }

  public toString(): string {
    return this.isRoot ? "_root_" : this.path.toString();
  }

  public get assignName(): string {
    return `_${this.nameCounter++}`;
  }
}

export class CPragma {
  public readonly loc: FileLoc;
  public readonly lib: CLib;

  public constructor(loc: FileLoc, lib: CLib) {
    this.loc = loc;
    this.lib = lib;
  }
}

export class CType {
  public readonly loc: FileLoc;
  public readonly name: string; // simple or dotted name

  private of?: CType[];

  constructor(loc: FileLoc, name: string, resolved: CProto | null = null) {
    this.loc = loc;
    this.name = name;
    this.resolved = resolved;
  }

  public static makeMaybe(of: CType): CType {
    const ret = new CType(of.loc, "sys.Maybe");
    ret.of = [of];

    return ret;
  }

  public static makeOr(of: CType[]): CType {
    const ret = new CType(of[0].loc, "sys.Or");
    ret.of = of;

    return ret;
  }

  public static makeAnd(of: CType[]): CType {
    const ret = new CType(of[0].loc, "sys.And");
    ret.of = of;

    return ret;
  }

  public static makeUnresolved(loc: FileLoc, name: string): CType {
    return new CType(loc, name);
  }

  public static makeResolved(loc: FileLoc, c: CProto): CType {
    return new CType(loc, c.name, c);
  }

  public isResolved(): boolean {
    return this.resolved !== null;
  }

  public deref(): CProto {
    if (this.resolved != null) {
      return this.resolved;
    }

    throw new Error(`Not resolved yet: ${this.name}`);
  }

  public get(name: string): CProto | undefined {
    if (this.of === undefined) {
      return this.deref().get(name, false);
    }

    for (let i = 0; i < this.of.length; i++) {
      const found = this.of[i].get(name);

      if (found != null) {
        return found;
      }
    }
  }

  public toString(): string {
    return this.name;
  }

  public resolved: CProto | null = null; // Resolve step
}
