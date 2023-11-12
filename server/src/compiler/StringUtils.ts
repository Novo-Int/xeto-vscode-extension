export function isAlpha(str: string): boolean {
  const code = str.charCodeAt(0);

  return (code >= 65 && code <= 90) || isLower(str);
}

export function isLower(str: string): boolean {
  const code = str.charCodeAt(0);

  return code >= 97 && code <= 122;
}

export function isNumeric(str: string): boolean {
  const code = str.charCodeAt(0);

  return code >= 48 && code <= 57;
}

export function isAlphaNumeric(str: string): boolean {
  return isAlpha(str) || isNumeric(str);
}

export function toHex(str: string): string {
  return str.charCodeAt(0).toString(16);
}

export function toCode(source: string, quote = '"'): string {
  const code = source.charCodeAt(0);
  let ret = source.charAt(0);

  if (code <= 20) {
    ret = `\\u00${code.toString(16)}`;
  }

  if (quote === null || quote === undefined) {
    return ret;
  }

  return `${quote}${ret}${quote}`;
}

export function trimToNull(str: string): string | null {
  const ret = str.trim();

  return ret === "" ? null : ret;
}

export function isIdChar(source: string): boolean {
  const code = source.charCodeAt(0);

  if (code < 127) {
    if (
      isAlphaNumeric(source) ||
      code === "_".charCodeAt(0) ||
      code === ":".charCodeAt(0) ||
      code === "-".charCodeAt(0) ||
      code === ".".charCodeAt(0) ||
      code === "~".charCodeAt(0)
    ) {
      return true;
    }

    return false;
  }

  return false;
}
