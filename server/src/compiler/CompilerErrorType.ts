import { type CompilerError, type ErrorTypes } from "./Errors";
import { type FileLoc } from "./FileLoc";

export type CompilerLogFunction = ((err: CompilerError) => void) &
  ((msg: string, type: ErrorTypes, where: FileLoc) => void);
