import { FileLoc } from './FileLoc';

export enum ErrorTypes {
	MISSING_TOKEN = "MISSING_TOKEN",
	UNCLOSED_STRING = "UNCLOSED_STRING",
	DUPLICATED_SYMBOL = "DUPLICATED_SYMBOL",
	UNKNOWN_SYMBOL = "UNKNOWN_SYMBOL",
}

export class CompilerError extends Error {
	public type: ErrorTypes;
	public loc: FileLoc;
	public endLoc: FileLoc;

	public constructor(message: string, type: ErrorTypes, loc: FileLoc, endLoc?: FileLoc) {
		super(message);
		this.type = type;
		this.loc = {...loc};

		if (endLoc) {
			this.endLoc = {...endLoc};
		} else {
			this.endLoc = new FileLoc(loc.file, loc.line, loc.col +1);
		}
	}
}

export class UnknownProtoError extends Error {
	public constructor(message: string) {
		super(message);
	}
}
