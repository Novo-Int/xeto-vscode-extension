import { LibraryManager } from "./LibManager";
import { XetoLib } from "./XetoLib";
import { ProtoCompiler } from "../compiler/Compiler";
import { readUrl } from "./utils";

import * as fs from "node:fs";
import * as path from "node:path";
import { EVENT_TYPE, eventBus } from '../events';

const loadExtLib = (root: string, lm: LibraryManager, priority: number) => {
  try {
    const files = fs.readdirSync(root, { withFileTypes: true });
    const libName = path.basename(root);

    //	parse the lib file first
    const libXetoContents = fs.readFileSync(`${root}/lib.xeto`).toString("utf-8");
    const libInfoCompiler = new ProtoCompiler(root);

    libInfoCompiler.run(libXetoContents);

    const libVersion =
      libInfoCompiler.root?.children["pragma"]?.children._version.type ||
      "unknown";
    const libDoc = libInfoCompiler.root?.children["pragma"]?.doc || "";

    const lib = new XetoLib(libName, libVersion, root, libDoc);
    lib.includePriority = priority;

    //	parse all files
    files
      .filter(
        (file) =>
          file.isFile() && file.name.endsWith("xeto") && file.name !== "lib.xeto"
      )
      .forEach((file) => {
        const filePath = path.join(root, file.name);
        const fileContent = fs.readFileSync(filePath).toString("utf-8");

        const compiler = new ProtoCompiler(filePath);
        compiler.run(fileContent);

        if (!compiler.root) {
          return;
        }

        Object.entries(compiler.root.children).forEach(([name, proto]) => {
          lib.addChild(name, proto);
        });
      });

    lm.addLib(lib);
  } catch (e) {
    console.log(e);
  }
};

const loadExtLibFromWeb = async (
  def: ExtLibDef,
  lm: LibraryManager,
  priority: number
) => {
  const libInfoUri = def.lib;

  const libXeto = await readUrl(libInfoUri);
  const libInfoCompiler = new ProtoCompiler(
    libInfoUri.replace("https://", "xeto://")
  );
  try {
    libInfoCompiler.run(libXeto);
  } catch (e) {
    console.log(e);
  }

  const libVersion =
    libInfoCompiler.root?.children["pragma"]?.children._version.type ||
    "unknown";
  const libDoc = libInfoCompiler.root?.children["pragma"]?.doc || "";

  const lib = new XetoLib(
    def.name,
    libVersion,
    libInfoUri.replace("https://", "xeto://"),
    libDoc
  );
  lib.includePriority = -1;

  // now that we have the lib read all the files
  const filesPr = def.files.map(async (uri) => {
    const compiler = new ProtoCompiler(uri.replace("https://", "xeto://"));
    const content = await readUrl(uri);
    compiler.run(content + "\0");

    if (!compiler.root) {
      return;
    }

    Object.entries(compiler.root.children).forEach(([name, proto]) => {
      lib.addChild(name, proto);
    });
  });

  await Promise.all(filesPr);

  lm.addLib(lib);
};

const isFolderLib = (path: string): boolean => fs.existsSync(`${path}/lib.xeto`);

export const loadExtLibs = (
  sources: (string | ExtLibDef)[],
  lm: LibraryManager
) => {
  sources.forEach((root, index) => {
    try {
      if (typeof root === "string") {
        //	check if we have a single lib or this is a repo of multiple libs
        if (isFolderLib(root)) {
          loadExtLib(root, lm, sources.length - index);
        } else {
          //	it doesn't have a lib.xeto, so check all the folders and check if those are libs
          const entries = fs.readdirSync(root, { withFileTypes: true });
          entries
            .filter(
              (entry) =>
                entry.isDirectory() && isFolderLib(`${root}/${entry.name}`)
            )
            .map((dir) =>
              loadExtLib(`${root}/${dir.name}`, lm, sources.length - index)
            );
        }
      } else {
        loadExtLibFromWeb(root, lm, sources.length - index);
      }
    } catch (e) {
      console.log(e);
    }
  });

  eventBus.fire(EVENT_TYPE.WORKSPACE_SCANNED);
};

export type ExtLibDef = {
  name: string;
  lib: string;
  files: string[];
};
