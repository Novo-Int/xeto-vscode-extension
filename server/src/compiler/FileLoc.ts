export class FileLoc {
    public readonly file: string;
    public readonly col: number;
    public readonly line: number;
    public readonly charIndex: number;

    public static synthetic = new FileLoc('synthetic');
    public static unknown = new FileLoc('unknown');
    
    public constructor(file: string, line = 0, col = 0, charIndex = 0) {
        this.file = file;
        this.line = line;
        this.col = col;
        this.charIndex = charIndex;
    }

    public static newWithOffset(from: FileLoc, lineOffset = 0, colOffset = 0): FileLoc {
        return new FileLoc(from.file, from.line + lineOffset, from.col + colOffset);
    }

    public toString(): string {
        return `line: ${this.line}, col: ${this.col}`;
    }
}