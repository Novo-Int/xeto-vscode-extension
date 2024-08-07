import { ProtoCompiler } from "../compiler/Compiler";
import { EVENT_TYPE, eventBus } from "../events";
import { type LibraryManager } from "./LibManager";
import { XetoLib } from "./XetoLib";

import { readUrl } from "./utils";

const librariesToAdd = [
  {
    name: "sys",
    files: [
      "meta.xeto",
      "types.xeto",
      "units.xeto",
      "timezones.xeto",
    ] as string[],
  },
  {
    name: "sys.comp",
    files: ["types.xeto"] as string[],
  },
  {
    name: "ph",
    files: [
      "kinds.xeto",
      "entities.xeto",
      "choices.xeto",
      "enums.xeto",
      "filetypes.xeto",
      "ops.xeto",
      "quantity.xeto",
      "tags.xeto",
      "phenomenon.xeto",
    ] as string[],
  },
  {
    name: "ph.equips",
    files: ["hvac.xeto", "meters.xeto"] as string[],
  },
  {
    name: "ph.points",
    files: [
      "air-flow.xeto",
      "air-humidity.xeto",
      "air-pressure.xeto",
      "air-temp.xeto",
      "base.xeto",
      "co2.xeto",
      "damper.xeto",
      "fan.xeto",
      "misc.xeto",
      "motor.xeto",
      "occupied.xeto",
      "valve.xeto",
    ] as string[],
  },
  {
    name: "ashrae.g36",
    files: ["vavs.xeto"] as string[],
  },
] as const;

const processSysLibNo = async (
  baseURL: string,
  lm: LibraryManager,
  index: number
): Promise<void> => {
  if (index >= librariesToAdd.length) {
    eventBus.fire(EVENT_TYPE.SYS_LIBS_LOADED);
    return;
  }

  const libInfo = librariesToAdd[index];

  //	reading lib.xeto to get meta data about the library
  const libInfoUri = `${baseURL}/${libInfo.name}/lib.xeto`;

  const libXeto = await readUrl(libInfoUri);
  const libInfoCompiler = new ProtoCompiler(
    libInfoUri.replace("https://", "xeto://")
  );
  try {
    libInfoCompiler.run(libXeto + "\0");
  } catch (e) {
    console.log(e);
  }

  const libVersion =
    libInfoCompiler.root?.children.pragma?.children._version.type ?? "unknown";
  const libDoc = libInfoCompiler.root?.children.pragma?.doc ?? "";

  const protoDeps =
    libInfoCompiler.root?.children.pragma?.children._depends?.children;

  const deps: string[] = [];

  protoDeps &&
    Object.keys(protoDeps).forEach((key) => {
      if (key.startsWith("#")) {
        return;
      }
      const dep = protoDeps[key].children?.lib?.type;
      if (!dep) {
        return;
      }

      deps.push(dep);
    });

  const lib = new XetoLib(
    libInfo.name,
    libVersion,
    libInfoUri.replace("https://", "xeto://"),
    libDoc
  );
  lib.includePriority = -1;
  lib.addMeta(libVersion, libDoc, deps);

  // now that we have the lib read all the files
  const filesPr = libInfo.files.map(async (fileName) => {
    const uri = `${baseURL}/${libInfo.name}/${fileName}`;

    const compiler = new ProtoCompiler(uri.replace("https://", "xeto://"));
    const content = await readUrl(uri);
    compiler.run(content + "\0");

    if (compiler.root == null) {
      return;
    }

    eventBus.fire(EVENT_TYPE.URI_PARSED, {
      uri: uri.replace("https", "xeto"),
      lib,
    });

    Object.entries(compiler.root.children).forEach(([name, proto]) => {
      lib.addChild(name, proto);
    });
  });

  await Promise.all(filesPr);

  lm.addLib(lib);

  void processSysLibNo(baseURL, lm, index + 1);
};

export const loadSysLibsFromGH = (sha: string, lm: LibraryManager): void => {
  const baseURL = `https://raw.githubusercontent.com/Project-Haystack/xeto/${sha}/src/xeto`;

  void processSysLibNo(baseURL, lm, 0);
};
