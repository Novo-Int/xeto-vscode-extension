import { type Connection } from "vscode-languageserver";
import { type CompilerError } from "./compiler/Errors";

export const VARS: {
  env: "BROWSER" | "NODE";
} = {
  env: "BROWSER",
};

export const isPartOfLib = async (
  path: string,
  connection: Connection
): Promise<boolean> => {
  if (VARS.env === "BROWSER") {
    const split = path.split("/");

    return await connection.sendRequest("xfs/exists", {
      path: [...[...split].slice(0, -1), "lib.xeto"].join("/"),
    });
  } else {
    try {
      const fs = await import("fs/promises");
      const osPath = await import("path");

      const libPath = path.match(/file:\/\/[a-zA-Z]:\//) ? path.replace("file://", "") : path.replace("file:/", "");

      const stat = await fs.stat(
        osPath.join(libPath, "..", "lib.xeto")
      );
      if (stat.isFile()) {
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }
};

export const isCompilerError = (error: any): error is CompilerError => {
  return "type" in error;
};
