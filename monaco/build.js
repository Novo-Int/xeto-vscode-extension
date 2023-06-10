//	@ts-check

const esbuild = require("esbuild");
const path = require("path");

const workerEntryPoints = ["vs/editor/editor.worker.js"];

build({
  entryPoints: workerEntryPoints.map(
    (entry) => `./node_modules/monaco-editor/esm/${entry}`
  ),
  bundle: true,
  format: "iife",
  outbase: "./node_modules/monaco-editor/esm/",
  outdir: path.join(__dirname, "dist"),
});

build({
  entryPoints: ["main.js"],
  bundle: true,
  format: "iife",
  outdir: path.join(__dirname, "dist"),
  loader: {
    ".ttf": "file",
  },
});

/**
 * @param {import ('esbuild').BuildOptions} opts
 */
function build(opts) {
  esbuild.build(opts).then((result) => {
    if (result.errors.length > 0) {
      console.error(result.errors);
    }
    if (result.warnings.length > 0) {
      console.error(result.warnings);
    }
  });
}
