import { Connection } from "vscode-languageserver";
import { isPartOfLib } from "./utils";
import { ProtoCompiler } from "./compiler/Compiler";
import { LibraryManager, XetoLib } from './libraries';

export const populateLibraryManager = async (
  compiler: ProtoCompiler,
  connection: Connection,
  libManager: LibraryManager
) => {
  if (!compiler.root) {
    return;
  }

  const split = compiler.sourceUri.split("/");

  const hasLib = await isPartOfLib(compiler.sourceUri, connection);

  let libName: string | undefined = undefined;
  let libVersion = "";
  let libDoc = "";
  const deps: string[] = [];

  if (hasLib) {
    libName = split[split.length - 2];
  }

  const isLibMeta = compiler.sourceUri.endsWith("lib.xeto");

  if (isLibMeta) {
    const pragma = compiler.root?.children["pragma"];

    libName = split[split.length - 2];
    libVersion = pragma?.children._version.type;
    libDoc = pragma?.doc || "";

    const protoDeps = pragma?.children._depends?.children;

    protoDeps &&
      Object.keys(protoDeps).forEach((key) => {
        if (key.startsWith("#")) {
          return;
        }

        deps.push(protoDeps[key].children.lib.type);
      });
  }

  if (!libName) {
    return;
  }

  if (!libManager.getLib(libName)) {
    libManager.addLib(
      new XetoLib(libName, libVersion, compiler.sourceUri, libDoc)
    );
  }

  const xetoLib = libManager.getLib(libName);

  if (!xetoLib) {
    return;
  }

  compilersToLibs.set(compiler, xetoLib);

  if (libVersion) {
    xetoLib.addMeta(libVersion, libDoc, deps);
  }

  if (!isLibMeta) {
    Object.entries(compiler.root.children).forEach(([name, proto]) => {
      xetoLib.addChild(name, proto);
    });
  }
};

export const compilersToLibs: Map<ProtoCompiler, XetoLib> = new Map();
