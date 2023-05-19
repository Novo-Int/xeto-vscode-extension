import { CompilerError, ErrorTypes } from './Errors';
import { FileLoc } from './FileLoc';

export type CompilerLogFunction =  ((err: CompilerError) => void) & 
	((msg: string, type: ErrorTypes, where: FileLoc) => void)

