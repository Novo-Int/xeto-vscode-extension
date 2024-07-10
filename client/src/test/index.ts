/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as path from "path";
import * as Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });
  mocha.timeout(100000);

  const testsRoot = __dirname;

  await new Promise((resolve, reject) => {
    glob(
      "**.test.js",
      { cwd: testsRoot },
      (err: Error | null, files: string[]) => {
        if (err) {
          reject(err);
          return;
        }

        // Add files to the test suite
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // Run the mocha test
          mocha.run((failures) => {
            if (failures > 0) {
              reject(new Error(`${failures} tests failed.`));
            } else {
              resolve(undefined);
            }
          });
        } catch (err) {
          console.error(err);
          reject(err);
        }
      }
    );
  });
}
