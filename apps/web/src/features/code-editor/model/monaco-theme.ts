import * as monaco from "monaco-editor";

let isThemeDefined = false;

export function ensurePixelleMonacoTheme() {
  if (isThemeDefined) {
    return;
  }

  monaco.editor.defineTheme("pixelle-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      {token: "", foreground: "dbe4d4", background: "080b08"},
      {token: "comment", foreground: "7f8979"},
      {token: "keyword", foreground: "caff86"},
      {token: "string", foreground: "9edbff"},
      {token: "number", foreground: "ffd166"},
      {token: "type", foreground: "b7ff55"},
    ],
    colors: {
      "editor.background": "#080b08",
      "editor.foreground": "#dbe4d4",
      "editor.lineHighlightBackground": "#141a12",
      "editorLineNumber.foreground": "#596154",
      "editorLineNumber.activeForeground": "#b7ff55",
      "editorCursor.foreground": "#b7ff55",
      "editor.selectionBackground": "#365124",
      "editor.inactiveSelectionBackground": "#26351d",
      "editorIndentGuide.background1": "#1c2419",
      "editorIndentGuide.activeBackground1": "#3c4736",
    },
  });

  isThemeDefined = true;
}
