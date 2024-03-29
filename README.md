# XETO Extension for VSCode

[![GitHub CI](https://github.com/Novo-Int/xeto-vscode-extension/actions/workflows/main.yml/badge.svg)](https://github.com/Novo-Int/xeto-vscode-extension/actions/workflows/main.yml)
[![License](https://img.shields.io/badge/license-bsd--3--clause-brightgreen)](https://opensource.org/license/bsd-3-clause/)

## Overview

The XETO Extension for VSCode provides language support and code editing features for the XETO language using the Language Server Protcol (LSP). It offers features as:

- syntax highlighting
- code completion
- diagnostics
- semantic tokens
- hover information
- go to definition
- rename symbols
- formatting

The extesion can be used both in:

- desktop environment (`VisualCode`)
- web environment, as a web extension (compatible with [vscode.dev](https://vscode.dev) and [github.dev](https://github.dev))

## Features

- Code editor features:

  - Syntax highlighting: Get syntax highlights for the `XETO` language
  - Folding: fold code around XETO constructs like `{` and `<`
  - Autoclosing: generate closing constructs for `{`, `<` and `'`
  - Sematic tokens support: change colors for tokens based on their semantics

  ![](./docs/images/syntax.gif)

- Diagnostics: Receive real-time errors regarding syntax problems

  ![](./docs/images/diagnostics.gif)

- Code completion proposals: Suggestions regarding properties on existing protos

  ![](./docs/images/completion.gif)

- Hover information: Show available docs for symbols

  ![](./docs/images/hover.gif)

- Show Definition of a Symbol: Peek the definition of a symbol defined either in the current workspace or in an external library

  ![](./docs/images/peek.gif)

- Go to definition of a Symbol: Navigation to symbols, both in the current workspace and in the external libraries

  ![](./docs/images/goto-def.gif)

- Formatting: Automatically format code according to language-specific rules.

  ![](./docs/images/format.gif)

- Rename symbol: Rename a symbol accross the entire workspace

  ![](./docs/images/rename.gif)

- Document symbols: Quickly search for symbols defined in the current file

  ![](./docs/images/doc-symbols.gif)

- Workspace symbols: Quickly search for symbols defined in the current workspace

  ![](./docs/images/workspace-symbols.gif)

- Document outline: Provides a fast way to see all the symbols defined in the current file and provides navigation the their definition

  ![](./docs/images/doc-outline.gif)

- Support for external libraries:
  - Define folders or files that are external to the workspace and use the symbols define there
  - Hover, Show Definition and Go to Definition work with these
- Support for `sys` libraries:

  - Load system libraries by specifiying a Git commit sha
  - this works similar to external libraries, but loading them via HTTP instead of local file system

- Support for data instances

## Configuration

The XETO Extension supports configurations for

- external libraries
- sys libraries

To modify the extension's settings access the settings panel (`Settings` -> `Settings` or use the shortcut <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> or <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on `Mac` and search for Settings). Then search for `xeto` and update them as needed.

Note: some settings cannot be changed via the UI so you may need to edit the `settings.json` file by hand.

## Usage

1. Open a `xeto` file that has the `.xeto` extension
2. The XETO Extension will automatically active and provide language-provided features
3. Use the provided Visual Studio Code keyboard actions and/or commands

Note: Some features (like go to definition) may take a few seconds to start, as we are reading `sys` libraries that are external to the host machine

## Installation

### Extension Marketplace

1. Launch Visual Studio Code
2. Open the `Extensions` tab using <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> or <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>
3. Search by using `xeto`
4. Install the extension

### GitHub Release

1. Go to the "Releases" [section](https://github.com/Novo-Int/xeto-vscode-extension/releases)
2. Download the latest release package under `extension.vsix`
3. Launch Visual Studio Code
4. Open the `Extensions` tab using <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> or <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>
5. Select `Install from VSIX...` from the `Views and More Actions` menu
6. Navigate to the downloaded file and select it

Note: more instructions on how to install extension from a `VSIX` [here](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix)

## License

This project is licensed under the BSD-3-Clause License. See the [LICENSE](https://opensource.org/license/bsd-3-clause/) for more info.
