import osPath = require('path');
import fs = require('fs');

import { CLib, CProto, CType } from '../CTypes';
import { Step } from './Step';
import { Parser } from '../Parser';
import { FileLoc } from '../FileLoc';
import { Path } from '../Path';

export class Parse extends Step
{
  public source = "";

  public run(isLibMetaFile = false): void {
    this.parseString(this.source, isLibMetaFile);
  }

  private parseLib(lib: CLib) {
    // lib.src.each |file| { parseFile(lib, file, lib.isLibMetaFile(file)) }
  }

  private parseString(toParse: string = this.source, isLibMetaFile = false) {
    try {
      const pound = toParse.indexOf("#<");
      const loc = new FileLoc("memory");
      let path: Path;
      let source = '';

      if (pound !== -1) {        
        const name = toParse.substring(0, pound).trim();
        source = toParse.substring(pound).trim();

        path = new Path(name);
        isLibMetaFile = true;
      } else {
        source = toParse;
        path = new Path('unnamed');

        //  check if this is part of a library
        if (fs.existsSync(osPath.join(this.compiler?.sourceUri.replace('file:/', ''), '..', 'lib.pog'))) {
          const split = this.compiler?.sourceUri.split('/');
          path = new Path(`${split[split.length-2]}.${split[split.length-1]}`);
        }
      }

      if (this.compiler?.sourceUri.endsWith('lib.pog')) {
        const split = this.compiler?.sourceUri.split('/');
        path = new Path(split[split.length - 2]);
      }

      const lib = new CLib(loc, path, source, this.initProto(loc, path));

      this.compiler.libs = [lib];

      const parser = new Parser(source, this);
      parser.parse(lib, isLibMetaFile);
    } catch (e: unknown) {
      console.log(e);
      throw e;
    }
  }

  private initProto(loc: FileLoc, path: Path): CProto
  {
    // build Lib object itself
    const proto = new CProto(loc, path.name, undefined, new CType(loc, "sys.Lib"));
    proto.isLib = true;

    return proto;
  }
}