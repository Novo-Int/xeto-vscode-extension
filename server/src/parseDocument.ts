import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver";
import { eventBus, EVENT_TYPE } from "./events";
import { isCompilerError, isPartOfLib } from "./utils";
import { ProtoCompiler } from "./compiler/Compiler";
import { LibraryManager, XetoLib } from "./libraries";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { FileLoc } from "./compiler/FileLoc";
import { Proto } from "./compiler/Proto";

let ARE_LIBS_LOADED = false;
let noLoaded = 0;

const libsLoadedCallback = () => {
	noLoaded ++;

	if (noLoaded === 3) {
		ARE_LIBS_LOADED = true;
	}
};

eventBus.addListener(EVENT_TYPE.EXTERNAL_LIBS_LOADED, libsLoadedCallback);
eventBus.addListener(EVENT_TYPE.SYS_LIBS_LOADED, libsLoadedCallback);
eventBus.addListener(EVENT_TYPE.WORKSPACE_SCANNED, libsLoadedCallback);

function fileLocToDiagPosition(loc: FileLoc): Position {
  return {
    line: loc.line,
    character: loc.col > 0 ? loc.col - 1 : loc.col,
  };
}

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

export const parseDocument = async (
  textDocument: TextDocument,
  connection: Connection,
  libManager: LibraryManager,
  compiledDocs: Record<string, ProtoCompiler>
): Promise<void> => {
  const diagnostics: Diagnostic[] = [];
  const compiler = new ProtoCompiler(textDocument.uri);
  const text = textDocument.getText();

  // if no compiler is saved then save one
  if (!compiledDocs[textDocument.uri]) {
    compiledDocs[textDocument.uri] = compiler;
  } else {
    // if a compiler is already present
    // only add a compiler if no errors are availabe
    // TO DO - remove this logic and always add the current compiler when we have a resilient compiler
    if (compiler.errs.length === 0) {
      compiledDocs[textDocument.uri] = compiler;
    }
  }

  try {
    compiler.run(text + "\0");
    compiler.errs.forEach((err) => {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: fileLocToDiagPosition(err.loc),
          end: fileLocToDiagPosition(err.endLoc),
        },
        message: err.message,
        //source: 'ex'
      };

      diagnostics.push(diagnostic);
    });
  } catch (e: unknown) {
    if (isCompilerError(e)) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(e.loc.charIndex),
          end: textDocument.positionAt(text.length),
        },
        message: e.message,
        //source: 'ex'
      };

      diagnostics.push(diagnostic);
    }
  } finally {
	if (ARE_LIBS_LOADED) {
		// resolve refs
		const missingRefs: Proto[] = [];
		compiler.root?.resolveRefTypes(compiler.root, libManager, missingRefs);

		const missingRefsDiagnostics = missingRefs.map(proto => ({
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(proto.qnameLoc || proto.loc.charIndex),
				end: textDocument.positionAt((proto.qnameLoc || proto.loc.charIndex) + proto.type.length)
			},
			message: 'No available definition for this proto'
		}));

		diagnostics.push(...missingRefsDiagnostics);
	}

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    // time to add it to the library manager
    populateLibraryManager(compiler, connection, libManager);
  }
  return;
};

export const compilersToLibs: Map<ProtoCompiler, XetoLib> = new Map();