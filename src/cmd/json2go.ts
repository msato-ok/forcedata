import { JsonCommand, AbstractPgCodeCommand, IJsonToPgCodeCommandOpt } from './base';
import { JsonParser } from '../parser/parser';
import { Printer } from '../printer/base';
import { GolangPrinter } from '../printer/golang';

export class JsonToGoCommand extends AbstractPgCodeCommand implements JsonCommand {
  constructor(option: IJsonToPgCodeCommandOpt, parser: JsonParser | null = null, printer: Printer | null = null) {
    if (printer == null) {
      printer = new GolangPrinter();
    }
    super(option, parser, printer);
  }
}
