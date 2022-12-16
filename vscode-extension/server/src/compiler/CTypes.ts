import { Path } from "./Path";
import { FileLoc } from "./FileLoc";

export class CLib {
  readonly path: Path; // library dotted name
  readonly qname: string; // dotted qualified name
  readonly loc: FileLoc; // location of directory
  readonly source: string;
  /*const File dir      // directory which contains lib.pog
    const File[] src    // pog files (first is always lib.pog)
    */
  readonly isSys: boolean; // is this the sys lib
  proto?: CProto; // proto cloned from sys.Lib
  depends?: CLib[]; // ResolveDepends
  resolvedNames = false; // ResolveNames

  //Bool isLibMetaFile(File f) { f === src.first }

  constructor(loc: FileLoc, path: Path, source: string, proto: CProto) {
    this.loc = loc;
    this.path = path;
    this.qname = path.toString();
    this.source = source;
    //this.dir   = dir
    //this.src   = src
    this.isSys = this.qname == "sys";
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

  public getOwn(name: string, checked = true): CProto | null {
    const kid = this.children[name];

    if (kid) return kid;
    if (checked) throw new Error(`${this.qname}.${name}`);

    return null;
  }

  get isRoot(): boolean {
    return this.parent === undefined;
  }

  get qname(): string {
    return this.path.toString();
  }

  get path(): Path {
    return this.isRoot ? Path.root : this.parent!.path.add(this.name);
  }

  public isObj(): boolean {
    return this.qname === "sys.Obj";
  }

  public toString(): string {
    return this.isRoot ? "_root_" : this.path.toString();
  }

  public get assignName(): string {
    return "_" + this.nameCounter++;
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

  constructor(loc: FileLoc, name: string, resolved: CProto | null = null) {
    this.loc = loc;
    this.name = name;
    this.resolved = resolved;
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
    if (this.resolved) {
      return this.resolved;
    }

    throw new Error(`Not resolved yet: ${this.name}`);
  }

  public toString(): string {
    return this.name;
  }

  public resolved: CProto | null = null; // Resolve step
}
