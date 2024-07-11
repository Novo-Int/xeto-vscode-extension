import { type Proto } from "../compiler/Proto";
import { Token } from "../compiler/Token";
import { findProtoByQname } from "../FindProto";
import { type XetoLib } from "./XetoLib";

const NAME_SEPARATOR = "#";
export class LibraryManager {
  private libs: Record<string, Record<string, XetoLib>> = {};

  private getLibHash(lib: XetoLib): string {
    return `${lib.name}${NAME_SEPARATOR}${lib.includePriority}`;
  }

  public addLib(lib: XetoLib): void {
    if (this.libs[lib.name] === undefined) {
      this.libs[lib.name] = {};
    }

    const key = this.getLibHash(lib);

    this.libs[lib.name][key] = lib;
  }

  public getLib(name: string): XetoLib | undefined {
    const libs = this.libs[name];

    if (!libs) {
      return undefined;
    }

    const registeredLibs = Object.keys(libs);

    //	get the one with the highest number
    const highestKey = Math.max(
      ...registeredLibs.map((key) => parseInt(key.split(NAME_SEPARATOR)[1]))
    );

    return libs[`${name}${NAME_SEPARATOR}${highestKey}`];
  }

  public findProtoByQName(
    qname: string,
    desiredLibs: string[] = []
  ): Proto | null {
    //	if we have desiredLibs let's look there first
    if (desiredLibs) {
      for (let i = 0; i < desiredLibs.length; i++) {
        const libName = desiredLibs[i];
        const lib = this.getLib(libName);

        if (lib == null) {
          continue;
        }

        const found = findProtoByQname(qname, lib.rootProto);

        if (found != null) {
          return found;
        }
      }
    }

    //  no explicit lib
    if (!qname.includes(Token.DOUBLE_COLON.toString())) {
      const lib = this.getLib(qname);

      if (!lib) {
        //  let search in sys lib
        const sysLib = this.getLib("sys");

        if (!sysLib) {
          return null;
        }

        return findProtoByQname(qname, sysLib.rootProto);
      }

      return findProtoByQname("", lib.rootProto);
    }

    const split = qname.split(Token.DOUBLE_COLON.toString());
    const isDataInstance = split[0].startsWith("@");

    //  need to check if this is not a dataInstance
    const lib = this.getLib(isDataInstance ? split[0].slice(1) : split[0]);

    if (!lib) {
      return null;
    }

    return findProtoByQname(
      isDataInstance ? "@" + split[1] : split[1],
      lib.rootProto
    );
  }
}
