import { JsonParseResult } from '../parser/parser';

export interface Printer {
  print(parseResult: JsonParseResult, outputPath: string): void;
}
