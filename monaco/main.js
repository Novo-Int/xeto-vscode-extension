import * as monaco from "monaco-editor/esm/vs/editor/editor.main.js";

self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    return "./vs/editor/editor.worker.js";
  },
};

monaco.editor.create(document.getElementById("container"), {
  value: `// xeto example

Foo: {
	marker,
	dict: sys::Dict
}
  `,
  language: "xeto",
});
