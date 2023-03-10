import { LibraryManager } from "./LibManager";
import { PogLib } from "./PogLib";
import { ProtoCompiler } from "../compiler/Compiler";

import * as fs from "node:fs";
import * as path from "node:path";

const loadExtLib = (root: string, lm: LibraryManager) => {
  try {
    const files = fs.readdirSync(root, { withFileTypes: true });
    const libName = path.basename(root);

    //	parse the lib file first
    const libPogContents = fs.readFileSync(`${root}/lib.pog`).toString("utf-8");
    const libInfoCompiler = new ProtoCompiler(root);

    libInfoCompiler.run(libPogContents);

    const libVersion =
      libInfoCompiler.root?.children["pragma"]?.children._version.type ||
      "unknown";
    const libDoc = libInfoCompiler.root?.children["pragma"]?.doc || "";

    const lib = new PogLib(libName, libVersion, root, true, libDoc);

    //	parse all files
    files
      .filter(
        (file) =>
          file.isFile() && file.name.endsWith("pog") && file.name !== "lib.pog"
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

const isFolderLib = (path: string): boolean => fs.existsSync(`${path}/lib.pog`);

export const loadExtLibs = (sources: string[], lm: LibraryManager) => {
  sources.forEach((root) => {
    try {
      //	check if we have a single lib or this is a repo of multiple libs
      if (isFolderLib(root)) {
        loadExtLib(root, lm);
      } else {
        //	it doesn't have a lib.pog, so check all the folders and check if those are libs
        const entries = fs.readdirSync(root, { withFileTypes: true });
        entries
          .filter(
            (entry) =>
              entry.isDirectory() && isFolderLib(`${root}/${entry.name}`)
          )
          .map((dir) => loadExtLib(`${root}/${dir.name}`, lm));
      }
    } catch (e) {
      console.log(e);
    }
  });
};
