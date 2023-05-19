// extensions/notebook-renderers/src/color.ts
function roundFloat(number, decimalPoints) {
  const decimal = Math.pow(10, decimalPoints);
  return Math.round(number * decimal) / decimal;
}
var RGBA = class {
  constructor(r, g, b, a = 1) {
    this._rgbaBrand = void 0;
    this.r = Math.min(255, Math.max(0, r)) | 0;
    this.g = Math.min(255, Math.max(0, g)) | 0;
    this.b = Math.min(255, Math.max(0, b)) | 0;
    this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
  }
  static equals(a, b) {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
  }
};
var HSLA = class {
  constructor(h, s, l, a) {
    this._hslaBrand = void 0;
    this.h = Math.max(Math.min(360, h), 0) | 0;
    this.s = roundFloat(Math.max(Math.min(1, s), 0), 3);
    this.l = roundFloat(Math.max(Math.min(1, l), 0), 3);
    this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
  }
  static equals(a, b) {
    return a.h === b.h && a.s === b.s && a.l === b.l && a.a === b.a;
  }
  /**
   * Converts an RGB color value to HSL. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes r, g, and b are contained in the set [0, 255] and
   * returns h in the set [0, 360], s, and l in the set [0, 1].
   */
  static fromRGBA(rgba) {
    const r = rgba.r / 255;
    const g = rgba.g / 255;
    const b = rgba.b / 255;
    const a = rgba.a;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (min + max) / 2;
    const chroma = max - min;
    if (chroma > 0) {
      s = Math.min(l <= 0.5 ? chroma / (2 * l) : chroma / (2 - 2 * l), 1);
      switch (max) {
        case r:
          h = (g - b) / chroma + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / chroma + 2;
          break;
        case b:
          h = (r - g) / chroma + 4;
          break;
      }
      h *= 60;
      h = Math.round(h);
    }
    return new HSLA(h, s, l, a);
  }
  static _hue2rgb(p, q, t) {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  }
  /**
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h in the set [0, 360] s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   */
  static toRGBA(hsla) {
    const h = hsla.h / 360;
    const { s, l, a } = hsla;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = HSLA._hue2rgb(p, q, h + 1 / 3);
      g = HSLA._hue2rgb(p, q, h);
      b = HSLA._hue2rgb(p, q, h - 1 / 3);
    }
    return new RGBA(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), a);
  }
};
var HSVA = class {
  constructor(h, s, v, a) {
    this._hsvaBrand = void 0;
    this.h = Math.max(Math.min(360, h), 0) | 0;
    this.s = roundFloat(Math.max(Math.min(1, s), 0), 3);
    this.v = roundFloat(Math.max(Math.min(1, v), 0), 3);
    this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
  }
  static equals(a, b) {
    return a.h === b.h && a.s === b.s && a.v === b.v && a.a === b.a;
  }
  // from http://www.rapidtables.com/convert/color/rgb-to-hsv.htm
  static fromRGBA(rgba) {
    const r = rgba.r / 255;
    const g = rgba.g / 255;
    const b = rgba.b / 255;
    const cmax = Math.max(r, g, b);
    const cmin = Math.min(r, g, b);
    const delta = cmax - cmin;
    const s = cmax === 0 ? 0 : delta / cmax;
    let m;
    if (delta === 0) {
      m = 0;
    } else if (cmax === r) {
      m = ((g - b) / delta % 6 + 6) % 6;
    } else if (cmax === g) {
      m = (b - r) / delta + 2;
    } else {
      m = (r - g) / delta + 4;
    }
    return new HSVA(Math.round(m * 60), s, cmax, rgba.a);
  }
  // from http://www.rapidtables.com/convert/color/hsv-to-rgb.htm
  static toRGBA(hsva) {
    const { h, s, v, a } = hsva;
    const c = v * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
    const m = v - c;
    let [r, g, b] = [0, 0, 0];
    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else if (h <= 360) {
      r = c;
      b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return new RGBA(r, g, b, a);
  }
};
var _Color = class {
  static fromHex(hex) {
    return _Color.Format.CSS.parseHex(hex) || _Color.red;
  }
  get hsla() {
    if (this._hsla) {
      return this._hsla;
    } else {
      return HSLA.fromRGBA(this.rgba);
    }
  }
  get hsva() {
    if (this._hsva) {
      return this._hsva;
    }
    return HSVA.fromRGBA(this.rgba);
  }
  constructor(arg) {
    if (!arg) {
      throw new Error("Color needs a value");
    } else if (arg instanceof RGBA) {
      this.rgba = arg;
    } else if (arg instanceof HSLA) {
      this._hsla = arg;
      this.rgba = HSLA.toRGBA(arg);
    } else if (arg instanceof HSVA) {
      this._hsva = arg;
      this.rgba = HSVA.toRGBA(arg);
    } else {
      throw new Error("Invalid color ctor argument");
    }
  }
  equals(other) {
    return !!other && RGBA.equals(this.rgba, other.rgba) && HSLA.equals(this.hsla, other.hsla) && HSVA.equals(this.hsva, other.hsva);
  }
  /**
   * http://www.w3.org/TR/WCAG20/#relativeluminancedef
   * Returns the number in the set [0, 1]. O => Darkest Black. 1 => Lightest white.
   */
  getRelativeLuminance() {
    const R = _Color._relativeLuminanceForComponent(this.rgba.r);
    const G = _Color._relativeLuminanceForComponent(this.rgba.g);
    const B = _Color._relativeLuminanceForComponent(this.rgba.b);
    const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    return roundFloat(luminance, 4);
  }
  static _relativeLuminanceForComponent(color) {
    const c = color / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  /**
   * http://www.w3.org/TR/WCAG20/#contrast-ratiodef
   * Returns the contrast ration number in the set [1, 21].
   */
  getContrastRatio(another) {
    const lum1 = this.getRelativeLuminance();
    const lum2 = another.getRelativeLuminance();
    return lum1 > lum2 ? (lum1 + 0.05) / (lum2 + 0.05) : (lum2 + 0.05) / (lum1 + 0.05);
  }
  /**
   *	http://24ways.org/2010/calculating-color-contrast
   *  Return 'true' if darker color otherwise 'false'
   */
  isDarker() {
    const yiq = (this.rgba.r * 299 + this.rgba.g * 587 + this.rgba.b * 114) / 1e3;
    return yiq < 128;
  }
  /**
   *	http://24ways.org/2010/calculating-color-contrast
   *  Return 'true' if lighter color otherwise 'false'
   */
  isLighter() {
    const yiq = (this.rgba.r * 299 + this.rgba.g * 587 + this.rgba.b * 114) / 1e3;
    return yiq >= 128;
  }
  isLighterThan(another) {
    const lum1 = this.getRelativeLuminance();
    const lum2 = another.getRelativeLuminance();
    return lum1 > lum2;
  }
  isDarkerThan(another) {
    const lum1 = this.getRelativeLuminance();
    const lum2 = another.getRelativeLuminance();
    return lum1 < lum2;
  }
  lighten(factor) {
    return new _Color(new HSLA(this.hsla.h, this.hsla.s, this.hsla.l + this.hsla.l * factor, this.hsla.a));
  }
  darken(factor) {
    return new _Color(new HSLA(this.hsla.h, this.hsla.s, this.hsla.l - this.hsla.l * factor, this.hsla.a));
  }
  transparent(factor) {
    const { r, g, b, a } = this.rgba;
    return new _Color(new RGBA(r, g, b, a * factor));
  }
  isTransparent() {
    return this.rgba.a === 0;
  }
  isOpaque() {
    return this.rgba.a === 1;
  }
  opposite() {
    return new _Color(new RGBA(255 - this.rgba.r, 255 - this.rgba.g, 255 - this.rgba.b, this.rgba.a));
  }
  blend(c) {
    const rgba = c.rgba;
    const thisA = this.rgba.a;
    const colorA = rgba.a;
    const a = thisA + colorA * (1 - thisA);
    if (a < 1e-6) {
      return _Color.transparent;
    }
    const r = this.rgba.r * thisA / a + rgba.r * colorA * (1 - thisA) / a;
    const g = this.rgba.g * thisA / a + rgba.g * colorA * (1 - thisA) / a;
    const b = this.rgba.b * thisA / a + rgba.b * colorA * (1 - thisA) / a;
    return new _Color(new RGBA(r, g, b, a));
  }
  makeOpaque(opaqueBackground) {
    if (this.isOpaque() || opaqueBackground.rgba.a !== 1) {
      return this;
    }
    const { r, g, b, a } = this.rgba;
    return new _Color(new RGBA(
      opaqueBackground.rgba.r - a * (opaqueBackground.rgba.r - r),
      opaqueBackground.rgba.g - a * (opaqueBackground.rgba.g - g),
      opaqueBackground.rgba.b - a * (opaqueBackground.rgba.b - b),
      1
    ));
  }
  flatten(...backgrounds) {
    const background = backgrounds.reduceRight((accumulator, color) => {
      return _Color._flatten(color, accumulator);
    });
    return _Color._flatten(this, background);
  }
  static _flatten(foreground, background) {
    const backgroundAlpha = 1 - foreground.rgba.a;
    return new _Color(new RGBA(
      backgroundAlpha * background.rgba.r + foreground.rgba.a * foreground.rgba.r,
      backgroundAlpha * background.rgba.g + foreground.rgba.a * foreground.rgba.g,
      backgroundAlpha * background.rgba.b + foreground.rgba.a * foreground.rgba.b
    ));
  }
  toString() {
    this._toString ?? (this._toString = _Color.Format.CSS.format(this));
    return this._toString;
  }
  static getLighterColor(of, relative, factor) {
    if (of.isLighterThan(relative)) {
      return of;
    }
    factor = factor ? factor : 0.5;
    const lum1 = of.getRelativeLuminance();
    const lum2 = relative.getRelativeLuminance();
    factor = factor * (lum2 - lum1) / lum2;
    return of.lighten(factor);
  }
  static getDarkerColor(of, relative, factor) {
    if (of.isDarkerThan(relative)) {
      return of;
    }
    factor = factor ? factor : 0.5;
    const lum1 = of.getRelativeLuminance();
    const lum2 = relative.getRelativeLuminance();
    factor = factor * (lum1 - lum2) / lum1;
    return of.darken(factor);
  }
};
var Color = _Color;
Color.white = new _Color(new RGBA(255, 255, 255, 1));
Color.black = new _Color(new RGBA(0, 0, 0, 1));
Color.red = new _Color(new RGBA(255, 0, 0, 1));
Color.blue = new _Color(new RGBA(0, 0, 255, 1));
Color.green = new _Color(new RGBA(0, 255, 0, 1));
Color.cyan = new _Color(new RGBA(0, 255, 255, 1));
Color.lightgrey = new _Color(new RGBA(211, 211, 211, 1));
Color.transparent = new _Color(new RGBA(0, 0, 0, 0));
((Color2) => {
  let Format;
  ((Format2) => {
    let CSS;
    ((CSS2) => {
      function formatRGB(color) {
        if (color.rgba.a === 1) {
          return `rgb(${color.rgba.r}, ${color.rgba.g}, ${color.rgba.b})`;
        }
        return Color2.Format.CSS.formatRGBA(color);
      }
      CSS2.formatRGB = formatRGB;
      function formatRGBA(color) {
        return `rgba(${color.rgba.r}, ${color.rgba.g}, ${color.rgba.b}, ${+color.rgba.a.toFixed(2)})`;
      }
      CSS2.formatRGBA = formatRGBA;
      function formatHSL(color) {
        if (color.hsla.a === 1) {
          return `hsl(${color.hsla.h}, ${(color.hsla.s * 100).toFixed(2)}%, ${(color.hsla.l * 100).toFixed(2)}%)`;
        }
        return Color2.Format.CSS.formatHSLA(color);
      }
      CSS2.formatHSL = formatHSL;
      function formatHSLA(color) {
        return `hsla(${color.hsla.h}, ${(color.hsla.s * 100).toFixed(2)}%, ${(color.hsla.l * 100).toFixed(2)}%, ${color.hsla.a.toFixed(2)})`;
      }
      CSS2.formatHSLA = formatHSLA;
      function _toTwoDigitHex(n) {
        const r = n.toString(16);
        return r.length !== 2 ? "0" + r : r;
      }
      function formatHex(color) {
        return `#${_toTwoDigitHex(color.rgba.r)}${_toTwoDigitHex(color.rgba.g)}${_toTwoDigitHex(color.rgba.b)}`;
      }
      CSS2.formatHex = formatHex;
      function formatHexA(color, compact = false) {
        if (compact && color.rgba.a === 1) {
          return Color2.Format.CSS.formatHex(color);
        }
        return `#${_toTwoDigitHex(color.rgba.r)}${_toTwoDigitHex(color.rgba.g)}${_toTwoDigitHex(color.rgba.b)}${_toTwoDigitHex(Math.round(color.rgba.a * 255))}`;
      }
      CSS2.formatHexA = formatHexA;
      function format(color) {
        if (color.isOpaque()) {
          return Color2.Format.CSS.formatHex(color);
        }
        return Color2.Format.CSS.formatRGBA(color);
      }
      CSS2.format = format;
      function parseHex(hex) {
        const length = hex.length;
        if (length === 0) {
          return null;
        }
        if (hex.charCodeAt(0) !== 35 /* Hash */) {
          return null;
        }
        if (length === 7) {
          const r = 16 * _parseHexDigit(hex.charCodeAt(1)) + _parseHexDigit(hex.charCodeAt(2));
          const g = 16 * _parseHexDigit(hex.charCodeAt(3)) + _parseHexDigit(hex.charCodeAt(4));
          const b = 16 * _parseHexDigit(hex.charCodeAt(5)) + _parseHexDigit(hex.charCodeAt(6));
          return new Color2(new RGBA(r, g, b, 1));
        }
        if (length === 9) {
          const r = 16 * _parseHexDigit(hex.charCodeAt(1)) + _parseHexDigit(hex.charCodeAt(2));
          const g = 16 * _parseHexDigit(hex.charCodeAt(3)) + _parseHexDigit(hex.charCodeAt(4));
          const b = 16 * _parseHexDigit(hex.charCodeAt(5)) + _parseHexDigit(hex.charCodeAt(6));
          const a = 16 * _parseHexDigit(hex.charCodeAt(7)) + _parseHexDigit(hex.charCodeAt(8));
          return new Color2(new RGBA(r, g, b, a / 255));
        }
        if (length === 4) {
          const r = _parseHexDigit(hex.charCodeAt(1));
          const g = _parseHexDigit(hex.charCodeAt(2));
          const b = _parseHexDigit(hex.charCodeAt(3));
          return new Color2(new RGBA(16 * r + r, 16 * g + g, 16 * b + b));
        }
        if (length === 5) {
          const r = _parseHexDigit(hex.charCodeAt(1));
          const g = _parseHexDigit(hex.charCodeAt(2));
          const b = _parseHexDigit(hex.charCodeAt(3));
          const a = _parseHexDigit(hex.charCodeAt(4));
          return new Color2(new RGBA(16 * r + r, 16 * g + g, 16 * b + b, (16 * a + a) / 255));
        }
        return null;
      }
      CSS2.parseHex = parseHex;
      function _parseHexDigit(charCode) {
        switch (charCode) {
          case 48 /* Digit0 */:
            return 0;
          case 49 /* Digit1 */:
            return 1;
          case 50 /* Digit2 */:
            return 2;
          case 51 /* Digit3 */:
            return 3;
          case 52 /* Digit4 */:
            return 4;
          case 53 /* Digit5 */:
            return 5;
          case 54 /* Digit6 */:
            return 6;
          case 55 /* Digit7 */:
            return 7;
          case 56 /* Digit8 */:
            return 8;
          case 57 /* Digit9 */:
            return 9;
          case 97 /* a */:
            return 10;
          case 65 /* A */:
            return 10;
          case 98 /* b */:
            return 11;
          case 66 /* B */:
            return 11;
          case 99 /* c */:
            return 12;
          case 67 /* C */:
            return 12;
          case 100 /* d */:
            return 13;
          case 68 /* D */:
            return 13;
          case 101 /* e */:
            return 14;
          case 69 /* E */:
            return 14;
          case 102 /* f */:
            return 15;
          case 70 /* F */:
            return 15;
        }
        return 0;
      }
    })(CSS = Format2.CSS || (Format2.CSS = {}));
  })(Format = Color2.Format || (Color2.Format = {}));
})(Color || (Color = {}));

// extensions/notebook-renderers/src/colorMap.ts
var ansiColorIdentifiers = [];
var ansiColorMap = {
  "terminal.ansiBlack": {
    index: 0
  },
  "terminal.ansiRed": {
    index: 1
  },
  "terminal.ansiGreen": {
    index: 2
  },
  "terminal.ansiYellow": {
    index: 3
  },
  "terminal.ansiBlue": {
    index: 4
  },
  "terminal.ansiMagenta": {
    index: 5
  },
  "terminal.ansiCyan": {
    index: 6
  },
  "terminal.ansiWhite": {
    index: 7
  },
  "terminal.ansiBrightBlack": {
    index: 8
  },
  "terminal.ansiBrightRed": {
    index: 9
  },
  "terminal.ansiBrightGreen": {
    index: 10
  },
  "terminal.ansiBrightYellow": {
    index: 11
  },
  "terminal.ansiBrightBlue": {
    index: 12
  },
  "terminal.ansiBrightMagenta": {
    index: 13
  },
  "terminal.ansiBrightCyan": {
    index: 14
  },
  "terminal.ansiBrightWhite": {
    index: 15
  }
};
for (const id in ansiColorMap) {
  const entry = ansiColorMap[id];
  const colorName = id.substring(13);
  ansiColorIdentifiers[entry.index] = { colorName, colorValue: "var(--vscode-" + id.replace(".", "-") + ")" };
}

// extensions/notebook-renderers/src/htmlHelper.ts
var ttPolicy = typeof window !== "undefined" ? window.trustedTypes?.createPolicy("notebookRenderer", {
  createHTML: (value) => value,
  createScript: (value) => value
}) : void 0;

// extensions/notebook-renderers/src/linkify.ts
var CONTROL_CODES = "\\u0000-\\u0020\\u007f-\\u009f";
var WEB_LINK_REGEX = new RegExp("(?:[a-zA-Z][a-zA-Z0-9+.-]{2,}:\\/\\/|data:|www\\.)[^\\s" + CONTROL_CODES + '"]{2,}[^\\s' + CONTROL_CODES + `"')}\\],:;.!?]`, "ug");
var WIN_ABSOLUTE_PATH = /(?<=^|\s)(?:[a-zA-Z]:(?:(?:\\|\/)[\w\.-]*)+)/;
var WIN_RELATIVE_PATH = /(?<=^|\s)(?:(?:\~|\.)(?:(?:\\|\/)[\w\.-]*)+)/;
var WIN_PATH = new RegExp(`(${WIN_ABSOLUTE_PATH.source}|${WIN_RELATIVE_PATH.source})`);
var POSIX_PATH = /(?<=^|\s)((?:\~|\.)?(?:\/[\w\.-]*)+)/;
var LINE_COLUMN = /(?:\:([\d]+))?(?:\:([\d]+))?/;
var isWindows = typeof navigator !== "undefined" ? navigator.userAgent && navigator.userAgent.indexOf("Windows") >= 0 : false;
var PATH_LINK_REGEX = new RegExp(`${isWindows ? WIN_PATH.source : POSIX_PATH.source}${LINE_COLUMN.source}`, "g");
var MAX_LENGTH = 2e3;
var LinkDetector = class {
  constructor() {
  }
  /**
   * Matches and handles web urls, absolute and relative file links in the string provided.
   * Returns <span/> element that wraps the processed string, where matched links are replaced by <a/>.
   * 'onclick' event is attached to all anchored links that opens them in the editor.
   * When splitLines is true, each line of the text, even if it contains no links, is wrapped in a <span>
   * and added as a child of the returned <span>.
   */
  linkify(text, splitLines, workspaceFolder) {
    if (splitLines) {
      const lines = text.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        lines[i] = lines[i] + "\n";
      }
      if (!lines[lines.length - 1]) {
        lines.pop();
      }
      const elements = lines.map((line) => this.linkify(line, false, workspaceFolder));
      if (elements.length === 1) {
        return elements[0];
      }
      const container2 = document.createElement("span");
      elements.forEach((e) => container2.appendChild(e));
      return container2;
    }
    const container = document.createElement("span");
    for (const part of this.detectLinks(text)) {
      try {
        switch (part.kind) {
          case "text":
            container.appendChild(document.createTextNode(part.value));
            break;
          case "web":
          case "path":
            container.appendChild(this.createWebLink(part.value));
            break;
        }
      } catch (e) {
        container.appendChild(document.createTextNode(part.value));
      }
    }
    return container;
  }
  createWebLink(url) {
    const link = this.createLink(url);
    link.href = url;
    return link;
  }
  // private createPathLink(text: string, path: string, lineNumber: number, columnNumber: number, workspaceFolder: string | undefined): Node {
  // 	if (path[0] === '/' && path[1] === '/') {
  // 		// Most likely a url part which did not match, for example ftp://path.
  // 		return document.createTextNode(text);
  // 	}
  // 	const options = { selection: { startLineNumber: lineNumber, startColumn: columnNumber } };
  // 	if (path[0] === '.') {
  // 		if (!workspaceFolder) {
  // 			return document.createTextNode(text);
  // 		}
  // 		const uri = workspaceFolder.toResource(path);
  // 		const link = this.createLink(text);
  // 		this.decorateLink(link, uri, (preserveFocus: boolean) => this.editorService.openEditor({ resource: uri, options: { ...options, preserveFocus } }));
  // 		return link;
  // 	}
  // 	if (path[0] === '~') {
  // 		const userHome = this.pathService.resolvedUserHome;
  // 		if (userHome) {
  // 			path = osPath.join(userHome.fsPath, path.substring(1));
  // 		}
  // 	}
  // 	const link = this.createLink(text);
  // 	link.tabIndex = 0;
  // 	const uri = URI.file(osPath.normalize(path));
  // 	this.fileService.resolve(uri).then(stat => {
  // 		if (stat.isDirectory) {
  // 			return;
  // 		}
  // 		this.decorateLink(link, uri, (preserveFocus: boolean) => this.editorService.openEditor({ resource: uri, options: { ...options, preserveFocus } }));
  // 	}).catch(() => {
  // 		// If the uri can not be resolved we should not spam the console with error, remain quite #86587
  // 	});
  // 	return link;
  // }
  createLink(text) {
    const link = document.createElement("a");
    link.textContent = text;
    return link;
  }
  detectLinks(text) {
    if (text.length > MAX_LENGTH) {
      return [{ kind: "text", value: text, captures: [] }];
    }
    const regexes = [WEB_LINK_REGEX, PATH_LINK_REGEX];
    const kinds = ["web", "path"];
    const result = [];
    const splitOne = (text2, regexIndex) => {
      if (regexIndex >= regexes.length) {
        result.push({ value: text2, kind: "text", captures: [] });
        return;
      }
      const regex = regexes[regexIndex];
      let currentIndex = 0;
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(text2)) !== null) {
        const stringBeforeMatch = text2.substring(currentIndex, match.index);
        if (stringBeforeMatch) {
          splitOne(stringBeforeMatch, regexIndex + 1);
        }
        const value = match[0];
        result.push({
          value,
          kind: kinds[regexIndex],
          captures: match.slice(1)
        });
        currentIndex = match.index + value.length;
      }
      const stringAfterMatches = text2.substring(currentIndex);
      if (stringAfterMatches) {
        splitOne(stringAfterMatches, regexIndex + 1);
      }
    };
    splitOne(text, 0);
    return result;
  }
};
var linkDetector = new LinkDetector();
function linkify(text, splitLines, workspaceFolder) {
  return linkDetector.linkify(text, splitLines, workspaceFolder);
}

// extensions/notebook-renderers/src/ansi.ts
function handleANSIOutput(text, trustHtml) {
  const workspaceFolder = void 0;
  const root = document.createElement("span");
  const textLength = text.length;
  let styleNames = [];
  let customFgColor;
  let customBgColor;
  let customUnderlineColor;
  let colorsInverted = false;
  let currentPos = 0;
  let buffer = "";
  while (currentPos < textLength) {
    let sequenceFound = false;
    if (text.charCodeAt(currentPos) === 27 && text.charAt(currentPos + 1) === "[") {
      const startPos = currentPos;
      currentPos += 2;
      let ansiSequence = "";
      while (currentPos < textLength) {
        const char = text.charAt(currentPos);
        ansiSequence += char;
        currentPos++;
        if (char.match(/^[ABCDHIJKfhmpsu]$/)) {
          sequenceFound = true;
          break;
        }
      }
      if (sequenceFound) {
        appendStylizedStringToContainer(root, buffer, trustHtml, styleNames, workspaceFolder, customFgColor, customBgColor, customUnderlineColor);
        buffer = "";
        if (ansiSequence.match(/^(?:[34][0-8]|9[0-7]|10[0-7]|[0-9]|2[1-5,7-9]|[34]9|5[8,9]|1[0-9])(?:;[349][0-7]|10[0-7]|[013]|[245]|[34]9)?(?:;[012]?[0-9]?[0-9])*;?m$/)) {
          const styleCodes = ansiSequence.slice(0, -1).split(";").filter((elem) => elem !== "").map((elem) => parseInt(elem, 10));
          if (styleCodes[0] === 38 || styleCodes[0] === 48 || styleCodes[0] === 58) {
            const colorType = styleCodes[0] === 38 ? "foreground" : styleCodes[0] === 48 ? "background" : "underline";
            if (styleCodes[1] === 5) {
              set8BitColor(styleCodes, colorType);
            } else if (styleCodes[1] === 2) {
              set24BitColor(styleCodes, colorType);
            }
          } else {
            setBasicFormatters(styleCodes);
          }
        } else {
        }
      } else {
        currentPos = startPos;
      }
    }
    if (sequenceFound === false) {
      buffer += text.charAt(currentPos);
      currentPos++;
    }
  }
  if (buffer) {
    appendStylizedStringToContainer(root, buffer, trustHtml, styleNames, workspaceFolder, customFgColor, customBgColor, customUnderlineColor);
  }
  return root;
  function changeColor(colorType, color) {
    if (colorType === "foreground") {
      customFgColor = color;
    } else if (colorType === "background") {
      customBgColor = color;
    } else if (colorType === "underline") {
      customUnderlineColor = color;
    }
    styleNames = styleNames.filter((style) => style !== `code-${colorType}-colored`);
    if (color !== void 0) {
      styleNames.push(`code-${colorType}-colored`);
    }
  }
  function reverseForegroundAndBackgroundColors() {
    const oldFgColor = customFgColor;
    changeColor("foreground", customBgColor);
    changeColor("background", oldFgColor);
  }
  function setBasicFormatters(styleCodes) {
    for (const code of styleCodes) {
      switch (code) {
        case 0: {
          styleNames = [];
          customFgColor = void 0;
          customBgColor = void 0;
          break;
        }
        case 1: {
          styleNames = styleNames.filter((style) => style !== `code-bold`);
          styleNames.push("code-bold");
          break;
        }
        case 2: {
          styleNames = styleNames.filter((style) => style !== `code-dim`);
          styleNames.push("code-dim");
          break;
        }
        case 3: {
          styleNames = styleNames.filter((style) => style !== `code-italic`);
          styleNames.push("code-italic");
          break;
        }
        case 4: {
          styleNames = styleNames.filter((style) => style !== `code-underline` && style !== `code-double-underline`);
          styleNames.push("code-underline");
          break;
        }
        case 5: {
          styleNames = styleNames.filter((style) => style !== `code-blink`);
          styleNames.push("code-blink");
          break;
        }
        case 6: {
          styleNames = styleNames.filter((style) => style !== `code-rapid-blink`);
          styleNames.push("code-rapid-blink");
          break;
        }
        case 7: {
          if (!colorsInverted) {
            colorsInverted = true;
            reverseForegroundAndBackgroundColors();
          }
          break;
        }
        case 8: {
          styleNames = styleNames.filter((style) => style !== `code-hidden`);
          styleNames.push("code-hidden");
          break;
        }
        case 9: {
          styleNames = styleNames.filter((style) => style !== `code-strike-through`);
          styleNames.push("code-strike-through");
          break;
        }
        case 10: {
          styleNames = styleNames.filter((style) => !style.startsWith("code-font"));
          break;
        }
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20: {
          styleNames = styleNames.filter((style) => !style.startsWith("code-font"));
          styleNames.push(`code-font-${code - 10}`);
          break;
        }
        case 21: {
          styleNames = styleNames.filter((style) => style !== `code-underline` && style !== `code-double-underline`);
          styleNames.push("code-double-underline");
          break;
        }
        case 22: {
          styleNames = styleNames.filter((style) => style !== `code-bold` && style !== `code-dim`);
          break;
        }
        case 23: {
          styleNames = styleNames.filter((style) => style !== `code-italic` && style !== `code-font-10`);
          break;
        }
        case 24: {
          styleNames = styleNames.filter((style) => style !== `code-underline` && style !== `code-double-underline`);
          break;
        }
        case 25: {
          styleNames = styleNames.filter((style) => style !== `code-blink` && style !== `code-rapid-blink`);
          break;
        }
        case 27: {
          if (colorsInverted) {
            colorsInverted = false;
            reverseForegroundAndBackgroundColors();
          }
          break;
        }
        case 28: {
          styleNames = styleNames.filter((style) => style !== `code-hidden`);
          break;
        }
        case 29: {
          styleNames = styleNames.filter((style) => style !== `code-strike-through`);
          break;
        }
        case 53: {
          styleNames = styleNames.filter((style) => style !== `code-overline`);
          styleNames.push("code-overline");
          break;
        }
        case 55: {
          styleNames = styleNames.filter((style) => style !== `code-overline`);
          break;
        }
        case 39: {
          changeColor("foreground", void 0);
          break;
        }
        case 49: {
          changeColor("background", void 0);
          break;
        }
        case 59: {
          changeColor("underline", void 0);
          break;
        }
        case 73: {
          styleNames = styleNames.filter((style) => style !== `code-superscript` && style !== `code-subscript`);
          styleNames.push("code-superscript");
          break;
        }
        case 74: {
          styleNames = styleNames.filter((style) => style !== `code-superscript` && style !== `code-subscript`);
          styleNames.push("code-subscript");
          break;
        }
        case 75: {
          styleNames = styleNames.filter((style) => style !== `code-superscript` && style !== `code-subscript`);
          break;
        }
        default: {
          setBasicColor(code);
          break;
        }
      }
    }
  }
  function set24BitColor(styleCodes, colorType) {
    if (styleCodes.length >= 5 && styleCodes[2] >= 0 && styleCodes[2] <= 255 && styleCodes[3] >= 0 && styleCodes[3] <= 255 && styleCodes[4] >= 0 && styleCodes[4] <= 255) {
      const customColor = new RGBA(styleCodes[2], styleCodes[3], styleCodes[4]);
      changeColor(colorType, customColor);
    }
  }
  function set8BitColor(styleCodes, colorType) {
    let colorNumber = styleCodes[2];
    const color = calcANSI8bitColor(colorNumber);
    if (color) {
      changeColor(colorType, color);
    } else if (colorNumber >= 0 && colorNumber <= 15) {
      if (colorType === "underline") {
        changeColor(colorType, ansiColorIdentifiers[colorNumber].colorValue);
        return;
      }
      colorNumber += 30;
      if (colorNumber >= 38) {
        colorNumber += 52;
      }
      if (colorType === "background") {
        colorNumber += 10;
      }
      setBasicColor(colorNumber);
    }
  }
  function setBasicColor(styleCode) {
    let colorType;
    let colorIndex;
    if (styleCode >= 30 && styleCode <= 37) {
      colorIndex = styleCode - 30;
      colorType = "foreground";
    } else if (styleCode >= 90 && styleCode <= 97) {
      colorIndex = styleCode - 90 + 8;
      colorType = "foreground";
    } else if (styleCode >= 40 && styleCode <= 47) {
      colorIndex = styleCode - 40;
      colorType = "background";
    } else if (styleCode >= 100 && styleCode <= 107) {
      colorIndex = styleCode - 100 + 8;
      colorType = "background";
    }
    if (colorIndex !== void 0 && colorType) {
      changeColor(colorType, ansiColorIdentifiers[colorIndex]?.colorValue);
    }
  }
}
function appendStylizedStringToContainer(root, stringContent, trustHtml, cssClasses, workspaceFolder, customTextColor, customBackgroundColor, customUnderlineColor) {
  if (!root || !stringContent) {
    return;
  }
  let container = document.createElement("span");
  if (trustHtml) {
    const trustedHtml = ttPolicy?.createHTML(stringContent) ?? stringContent;
    container.innerHTML = trustedHtml;
  }
  if (container.childElementCount === 0) {
    container = linkify(stringContent, true, workspaceFolder);
  }
  container.className = cssClasses.join(" ");
  if (customTextColor) {
    container.style.color = typeof customTextColor === "string" ? customTextColor : Color.Format.CSS.formatRGB(new Color(customTextColor));
  }
  if (customBackgroundColor) {
    container.style.backgroundColor = typeof customBackgroundColor === "string" ? customBackgroundColor : Color.Format.CSS.formatRGB(new Color(customBackgroundColor));
  }
  if (customUnderlineColor) {
    container.style.textDecorationColor = typeof customUnderlineColor === "string" ? customUnderlineColor : Color.Format.CSS.formatRGB(new Color(customUnderlineColor));
  }
  root.appendChild(container);
}
function calcANSI8bitColor(colorNumber) {
  if (colorNumber % 1 !== 0) {
    return;
  }
  if (colorNumber >= 16 && colorNumber <= 231) {
    colorNumber -= 16;
    let blue = colorNumber % 6;
    colorNumber = (colorNumber - blue) / 6;
    let green = colorNumber % 6;
    colorNumber = (colorNumber - green) / 6;
    let red = colorNumber;
    const convFactor = 255 / 5;
    blue = Math.round(blue * convFactor);
    green = Math.round(green * convFactor);
    red = Math.round(red * convFactor);
    return new RGBA(red, green, blue);
  } else if (colorNumber >= 232 && colorNumber <= 255) {
    colorNumber -= 232;
    const colorLevel = Math.round(colorNumber / 23 * 255);
    return new RGBA(colorLevel, colorLevel, colorLevel);
  } else {
    return;
  }
}

// extensions/notebook-renderers/src/textHelper.ts
var scrollableClass = "scrollable";
function generateViewMoreElement(outputId) {
  const container = document.createElement("div");
  container.classList.add("truncation-message");
  const first = document.createElement("span");
  first.textContent = "Output is truncated. View as a ";
  container.appendChild(first);
  const viewAsScrollableLink = document.createElement("a");
  viewAsScrollableLink.textContent = "scrollable element";
  viewAsScrollableLink.href = `command:cellOutput.enableScrolling?${outputId}`;
  viewAsScrollableLink.ariaLabel = "enable scrollable output";
  container.appendChild(viewAsScrollableLink);
  const second = document.createElement("span");
  second.textContent = " or open in a ";
  container.appendChild(second);
  const openInTextEditorLink = document.createElement("a");
  openInTextEditorLink.textContent = "text editor";
  openInTextEditorLink.href = `command:workbench.action.openLargeOutput?${outputId}`;
  openInTextEditorLink.ariaLabel = "open output in text editor";
  container.appendChild(openInTextEditorLink);
  const third = document.createElement("span");
  third.textContent = ". Adjust cell output ";
  container.appendChild(third);
  const layoutSettingsLink = document.createElement("a");
  layoutSettingsLink.textContent = "settings";
  layoutSettingsLink.href = `command:workbench.action.openSettings?%5B%22%40tag%3AnotebookOutputLayout%22%5D`;
  layoutSettingsLink.ariaLabel = "notebook output settings";
  container.appendChild(layoutSettingsLink);
  const fourth = document.createElement("span");
  fourth.textContent = "...";
  container.appendChild(fourth);
  return container;
}
function generateNestedViewAllElement(outputId) {
  const container = document.createElement("div");
  const link = document.createElement("a");
  link.textContent = "...";
  link.href = `command:workbench.action.openLargeOutput?${outputId}`;
  link.ariaLabel = "Open full output in text editor";
  link.title = "Open full output in text editor";
  link.style.setProperty("text-decoration", "none");
  container.appendChild(link);
  return container;
}
function truncatedArrayOfString(id, buffer, linesLimit, trustHtml) {
  const container = document.createElement("div");
  const lineCount = buffer.length;
  if (lineCount <= linesLimit) {
    const spanElement = handleANSIOutput(buffer.join("\n"), trustHtml);
    container.appendChild(spanElement);
    return container;
  }
  container.appendChild(handleANSIOutput(buffer.slice(0, linesLimit - 5).join("\n"), trustHtml));
  const elipses = document.createElement("div");
  elipses.innerText = "...";
  container.appendChild(elipses);
  container.appendChild(handleANSIOutput(buffer.slice(lineCount - 5).join("\n"), trustHtml));
  container.appendChild(generateViewMoreElement(id));
  return container;
}
function scrollableArrayOfString(id, buffer, trustHtml) {
  const element = document.createElement("div");
  if (buffer.length > 5e3) {
    element.appendChild(generateNestedViewAllElement(id));
  }
  element.appendChild(handleANSIOutput(buffer.slice(-5e3).join("\n"), trustHtml));
  return element;
}
function createOutputContent(id, outputs, linesLimit, scrollable, trustHtml) {
  const buffer = outputs.join("\n").split(/\r\n|\r|\n/g);
  if (scrollable) {
    return scrollableArrayOfString(id, buffer, trustHtml);
  } else {
    return truncatedArrayOfString(id, buffer, linesLimit, trustHtml);
  }
}

// extensions/notebook-renderers/src/index.ts
function clearContainer(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}
function renderImage(outputInfo, element) {
  const blob = new Blob([outputInfo.data()], { type: outputInfo.mime });
  const src = URL.createObjectURL(blob);
  const disposable = {
    dispose: () => {
      URL.revokeObjectURL(src);
    }
  };
  if (element.firstChild) {
    const display2 = element.firstChild;
    if (display2.firstChild && display2.firstChild.nodeName === "IMG" && display2.firstChild instanceof HTMLImageElement) {
      display2.firstChild.src = src;
      return disposable;
    }
  }
  const image = document.createElement("img");
  image.src = src;
  const display = document.createElement("div");
  display.classList.add("display");
  display.appendChild(image);
  element.appendChild(display);
  return disposable;
}
var preservedScriptAttributes = [
  "type",
  "src",
  "nonce",
  "noModule",
  "async"
];
var domEval = (container) => {
  const arr = Array.from(container.getElementsByTagName("script"));
  for (let n = 0; n < arr.length; n++) {
    const node = arr[n];
    const scriptTag = document.createElement("script");
    const trustedScript = ttPolicy?.createScript(node.innerText) ?? node.innerText;
    scriptTag.text = trustedScript;
    for (const key of preservedScriptAttributes) {
      const val = node[key] || node.getAttribute && node.getAttribute(key);
      if (val) {
        scriptTag.setAttribute(key, val);
      }
    }
    container.appendChild(scriptTag).parentNode.removeChild(scriptTag);
  }
};
async function renderHTML(outputInfo, container, signal, hooks) {
  clearContainer(container);
  let element = document.createElement("div");
  const htmlContent = outputInfo.text();
  const trustedHtml = ttPolicy?.createHTML(htmlContent) ?? htmlContent;
  element.innerHTML = trustedHtml;
  for (const hook of hooks) {
    element = await hook.postRender(outputInfo, element, signal) ?? element;
    if (signal.aborted) {
      return;
    }
  }
  container.appendChild(element);
  domEval(element);
}
async function renderJavascript(outputInfo, container, signal, hooks) {
  let scriptText = outputInfo.text();
  for (const hook of hooks) {
    scriptText = await hook.preEvaluate(outputInfo, container, scriptText, signal) ?? scriptText;
    if (signal.aborted) {
      return;
    }
  }
  const script = document.createElement("script");
  script.type = "module";
  script.textContent = scriptText;
  const element = document.createElement("div");
  const trustedHtml = ttPolicy?.createHTML(script.outerHTML) ?? script.outerHTML;
  element.innerHTML = trustedHtml;
  container.appendChild(element);
  domEval(element);
}
function createDisposableStore() {
  const localDisposables = [];
  const disposable = {
    push: (...disposables) => {
      localDisposables.push(...disposables);
    },
    dispose: () => {
      localDisposables.forEach((d) => d.dispose());
    }
  };
  return disposable;
}
function renderError(outputInfo, outputElement, ctx, trustHTML) {
  const disposableStore = createDisposableStore();
  clearContainer(outputElement);
  let err;
  try {
    err = JSON.parse(outputInfo.text());
  } catch (e) {
    console.log(e);
    return disposableStore;
  }
  if (err.stack) {
    outputElement.classList.add("traceback");
    const outputScrolling = scrollingEnabled(outputInfo, ctx.settings);
    const content = createOutputContent(outputInfo.id, [err.stack ?? ""], ctx.settings.lineLimit, outputScrolling, trustHTML);
    const contentParent = document.createElement("div");
    contentParent.classList.toggle("word-wrap", ctx.settings.outputWordWrap);
    disposableStore.push(ctx.onDidChangeSettings((e) => {
      contentParent.classList.toggle("word-wrap", e.outputWordWrap);
    }));
    contentParent.classList.toggle("scrollable", outputScrolling);
    contentParent.appendChild(content);
    outputElement.appendChild(contentParent);
    initializeScroll(contentParent, disposableStore);
  } else {
    const header = document.createElement("div");
    const headerMessage = err.name && err.message ? `${err.name}: ${err.message}` : err.name || err.message;
    if (headerMessage) {
      header.innerText = headerMessage;
      outputElement.appendChild(header);
    }
  }
  outputElement.classList.add("error");
  return disposableStore;
}
function getPreviousMatchingContentGroup(outputElement) {
  const outputContainer = outputElement.parentElement;
  let match = void 0;
  let previous = outputContainer?.previousSibling;
  while (previous) {
    const outputElement2 = previous.firstChild;
    if (!outputElement2 || !outputElement2.classList.contains("output-stream")) {
      break;
    }
    match = outputElement2.firstChild;
    previous = previous?.previousSibling;
  }
  return match;
}
function onScrollHandler(e) {
  const target = e.target;
  if (target.scrollTop === 0) {
    target.classList.remove("more-above");
  } else {
    target.classList.add("more-above");
  }
}
function onKeypressHandler(e) {
  if (e.ctrlKey || e.shiftKey) {
    return;
  }
  if (e.code === "ArrowDown" || e.code === "End" || e.code === "ArrowUp" || e.code === "Home") {
    e.stopPropagation();
  }
}
function initializeScroll(scrollableElement, disposables, scrollTop) {
  if (scrollableElement.classList.contains(scrollableClass)) {
    const scrollbarVisible = scrollableElement.scrollHeight > scrollableElement.clientHeight;
    scrollableElement.classList.toggle("scrollbar-visible", scrollbarVisible);
    scrollableElement.scrollTop = scrollTop !== void 0 ? scrollTop : scrollableElement.scrollHeight;
    if (scrollbarVisible) {
      scrollableElement.addEventListener("scroll", onScrollHandler);
      disposables.push({ dispose: () => scrollableElement.removeEventListener("scroll", onScrollHandler) });
      scrollableElement.addEventListener("keydown", onKeypressHandler);
      disposables.push({ dispose: () => scrollableElement.removeEventListener("keydown", onKeypressHandler) });
    }
  }
}
function findScrolledHeight(container) {
  const scrollableElement = container.querySelector("." + scrollableClass);
  if (scrollableElement && scrollableElement.scrollHeight - scrollableElement.scrollTop - scrollableElement.clientHeight > 2) {
    return scrollableElement.scrollTop;
  }
  return void 0;
}
function scrollingEnabled(output, options) {
  const metadata = output.metadata;
  return typeof metadata === "object" && metadata && "scrollable" in metadata && typeof metadata.scrollable === "boolean" ? metadata.scrollable : options.outputScrolling;
}
function renderStream(outputInfo, outputElement, error, ctx) {
  const disposableStore = createDisposableStore();
  const outputScrolling = scrollingEnabled(outputInfo, ctx.settings);
  outputElement.classList.add("output-stream");
  const text = outputInfo.text();
  const content = createOutputContent(outputInfo.id, [text], ctx.settings.lineLimit, outputScrolling, false);
  content.setAttribute("output-item-id", outputInfo.id);
  if (error) {
    content.classList.add("error");
  }
  const scrollTop = outputScrolling ? findScrolledHeight(outputElement) : void 0;
  const existingContentParent = getPreviousMatchingContentGroup(outputElement);
  if (existingContentParent) {
    const existing = existingContentParent.querySelector(`[output-item-id="${outputInfo.id}"]`);
    if (existing) {
      existing.replaceWith(content);
    } else {
      existingContentParent.appendChild(content);
    }
    existingContentParent.classList.toggle("scrollbar-visible", existingContentParent.scrollHeight > existingContentParent.clientHeight);
    existingContentParent.scrollTop = scrollTop !== void 0 ? scrollTop : existingContentParent.scrollHeight;
  } else {
    const contentParent = document.createElement("div");
    contentParent.appendChild(content);
    contentParent.classList.toggle("scrollable", outputScrolling);
    contentParent.classList.toggle("word-wrap", ctx.settings.outputWordWrap);
    disposableStore.push(ctx.onDidChangeSettings((e) => {
      contentParent.classList.toggle("word-wrap", e.outputWordWrap);
    }));
    while (outputElement.firstChild) {
      outputElement.removeChild(outputElement.firstChild);
    }
    outputElement.appendChild(contentParent);
    initializeScroll(contentParent, disposableStore, scrollTop);
  }
  return disposableStore;
}
function renderText(outputInfo, outputElement, ctx) {
  const disposableStore = createDisposableStore();
  clearContainer(outputElement);
  const text = outputInfo.text();
  const outputScrolling = scrollingEnabled(outputInfo, ctx.settings);
  const content = createOutputContent(outputInfo.id, [text], ctx.settings.lineLimit, ctx.settings.outputScrolling, false);
  content.classList.add("output-plaintext");
  if (ctx.settings.outputWordWrap) {
    content.classList.add("word-wrap");
  }
  content.classList.toggle("scrollable", outputScrolling);
  outputElement.appendChild(content);
  initializeScroll(content, disposableStore);
  return disposableStore;
}
var activate = (ctx) => {
  const disposables = /* @__PURE__ */ new Map();
  const htmlHooks = /* @__PURE__ */ new Set();
  const jsHooks = /* @__PURE__ */ new Set();
  const latestContext = ctx;
  const style = document.createElement("style");
  style.textContent = `
	#container div.output.remove-padding {
		padding-left: 0;
		padding-right: 0;
	}
	.output-plaintext,
	.output-stream,
	.traceback {
		display: inline-block;
		width: 100%;
		line-height: var(--notebook-cell-output-line-height);
		font-family: var(--notebook-cell-output-font-family);
		font-size: var(--notebook-cell-output-font-size);
		user-select: text;
		-webkit-user-select: text;
		-ms-user-select: text;
		cursor: auto;
		word-wrap: break-word;
		/* text/stream output container should scroll but preserve newline character */
		white-space: pre;
	}
	/* When wordwrap turned on, force it to pre-wrap */
	#container div.output_container .word-wrap span {
		white-space: pre-wrap;
	}
	#container div.output>div {
		padding-left: var(--notebook-output-node-left-padding);
		padding-right: var(--notebook-output-node-padding);
		box-sizing: border-box;
		border-width: 1px;
		border-style: solid;
		border-color: transparent;
	}
	#container div.output>div:focus {
		outline: 0;
		border-color: var(--theme-input-focus-border-color);
	}
	#container div.output .scrollable {
		overflow-y: scroll;
		max-height: var(--notebook-cell-output-max-height);
	}
	#container div.output .scrollable.scrollbar-visible {
		border-color: var(--vscode-editorWidget-border);
	}
	#container div.output .scrollable.scrollbar-visible:focus {
		border-color: var(--theme-input-focus-border-color);
	}
	#container div.truncation-message {
		font-style: italic;
		font-family: var(--theme-font-family);
		padding-top: 4px;
	}
	#container div.output .scrollable div {
		cursor: text;
	}
	#container div.output .scrollable div a {
		cursor: pointer;
	}
	#container div.output .scrollable.more-above {
		box-shadow: var(--vscode-scrollbar-shadow) 0 6px 6px -6px inset
	}
	.output-plaintext .code-bold,
	.output-stream .code-bold,
	.traceback .code-bold {
		font-weight: bold;
	}
	.output-plaintext .code-italic,
	.output-stream .code-italic,
	.traceback .code-italic {
		font-style: italic;
	}
	.output-plaintext .code-strike-through,
	.output-stream .code-strike-through,
	.traceback .code-strike-through {
		text-decoration: line-through;
	}
	.output-plaintext .code-underline,
	.output-stream .code-underline,
	.traceback .code-underline {
		text-decoration: underline;
	}
	`;
  document.body.appendChild(style);
  return {
    renderOutputItem: async (outputInfo, element, signal) => {
      element.classList.add("remove-padding");
      switch (outputInfo.mime) {
        case "text/html":
        case "image/svg+xml": {
          if (!ctx.workspace.isTrusted) {
            return;
          }
          await renderHTML(outputInfo, element, signal, htmlHooks);
          break;
        }
        case "application/javascript": {
          if (!ctx.workspace.isTrusted) {
            return;
          }
          renderJavascript(outputInfo, element, signal, jsHooks);
          break;
        }
        case "image/gif":
        case "image/png":
        case "image/jpeg":
        case "image/git":
          {
            disposables.get(outputInfo.id)?.dispose();
            const disposable = renderImage(outputInfo, element);
            disposables.set(outputInfo.id, disposable);
          }
          break;
        case "application/vnd.code.notebook.error":
          {
            disposables.get(outputInfo.id)?.dispose();
            const disposable = renderError(outputInfo, element, latestContext, ctx.workspace.isTrusted);
            disposables.set(outputInfo.id, disposable);
          }
          break;
        case "application/vnd.code.notebook.stdout":
        case "application/x.notebook.stdout":
        case "application/x.notebook.stream":
          {
            disposables.get(outputInfo.id)?.dispose();
            const disposable = renderStream(outputInfo, element, false, latestContext);
            disposables.set(outputInfo.id, disposable);
          }
          break;
        case "application/vnd.code.notebook.stderr":
        case "application/x.notebook.stderr":
          {
            disposables.get(outputInfo.id)?.dispose();
            const disposable = renderStream(outputInfo, element, true, latestContext);
            disposables.set(outputInfo.id, disposable);
          }
          break;
        case "text/plain":
          {
            disposables.get(outputInfo.id)?.dispose();
            const disposable = renderText(outputInfo, element, latestContext);
            disposables.set(outputInfo.id, disposable);
          }
          break;
        default:
          break;
      }
      if (element.querySelector("div")) {
        element.querySelector("div").tabIndex = 0;
      }
    },
    disposeOutputItem: (id) => {
      if (id) {
        disposables.get(id)?.dispose();
      } else {
        disposables.forEach((d) => d.dispose());
      }
    },
    experimental_registerHtmlRenderingHook: (hook) => {
      htmlHooks.add(hook);
      return {
        dispose: () => {
          htmlHooks.delete(hook);
        }
      };
    },
    experimental_registerJavaScriptRenderingHook: (hook) => {
      jsHooks.add(hook);
      return {
        dispose: () => {
          jsHooks.delete(hook);
        }
      };
    }
  };
};
export {
  activate
};
