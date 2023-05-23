import { isAlpha, isAlphaNumeric } from "./StringUtils";

export class Path {
  static root: Path = {
    name: "",
    size: 0,
    add: (segment: string) => new Path(segment),
    isRoot: true,
    toString: () => "",
    // https://stackoverflow.com/questions/34523334/how-to-assign-object-literal-to-variable-with-private-properties
    ...({} as any),
  };

  private readonly segments: string[] = [];

  public constructor(...rest: string[]) {
    this.segments = [...rest];
  }

  static fromString(path: string): Path {
    const segments = path.split(".");

    if (
      segments.some(
        (s) =>
          s === "" ||
          (!isAlpha(s.charAt(0)) && s.charAt(0) !== "_") ||
          s.split("").some((l) => !isAlphaNumeric(l))
      )
    ) {
      throw new Error(`Path is not valid ${path}`);
    }

    return new Path(...segments);
  }

  get name(): string {
    return this.segments[this.segments.length - 1];
  }

  get size(): number {
    return this.segments.length;
  }

  readonly isRoot = false;

  public add(segment: string): Path {
    return new Path(...this.segments, segment);
  }

  public toString(): string {
    return this.segments.join(".");
  }
}
