import { Connection } from "vscode-languageserver";

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

    return connection.sendRequest("xfs/exists", {
      path: [...[...split].slice(0, -1), "lib.xeto"].join("/"),
    });
  } else {
    try {
      const fs = await import("fs/promises");
      const osPath = await import("path");

      const stat = await fs.stat(
        osPath.join(path.replace("file:/", ""), "..", "lib.xeto")
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
