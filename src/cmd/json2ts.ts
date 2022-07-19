import { JsonCommand, AbstractPgCodeCommand, IJsonToPgCodeCommandOpt } from './base';
import { JsonParser } from '../parser/parser';
import { Printer } from '../printer/base';
import { TsPrinter } from '../printer/typescript';

export class JsonToTsCommand extends AbstractPgCodeCommand implements JsonCommand {
  constructor(option: IJsonToPgCodeCommandOpt, parser: JsonParser | null = null, printer: Printer | null = null) {
    if (printer == null) {
      printer = new TsPrinter();
    }
    super(option, parser, printer);
  }
}
