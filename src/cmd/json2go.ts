import { JsonCommand, AbstractPgCodeCommand, IJsonToPgCodeCommandOpt } from './base';
import { JsonParser } from '../parser/parser';
import { Printer } from '../printer/base';
import { GolangPrinter } from '../printer/golang';
import path from 'path';

export class JsonToGoCommand extends AbstractPgCodeCommand implements JsonCommand {
  constructor(option: IJsonToPgCodeCommandOpt, parser: JsonParser | null = null, printer: Printer | null = null) {
    if (printer == null) {
      let pkg = option.package;
      if (!pkg || pkg.length == 0) {
        const lastdir = path.dirname(option.output).split(path.sep).pop();
        if (!lastdir) {
          pkg = 'main';
        } else {
          pkg = lastdir;
        }
      }
      printer = new GolangPrinter(pkg);
    }
    super(option, parser, printer);
  }
}
