import { JsonCommand, AbstractCommandOption, ICommandOption } from './base';
import { JsonParser } from '../parser/parser';
import { YmlTypePrinter } from '../printer/yml_type';
import glob from 'glob';

export interface IJsonToTypeCommandOption extends ICommandOption {
  output: string;
  model: string;
}

export class JsonToTypeCommand extends AbstractCommandOption implements JsonCommand {
  private rootDataName: string;

  constructor(
    protected _option: IJsonToTypeCommandOption,
    private parser: JsonParser = new JsonParser(null),
    private printer: YmlTypePrinter = new YmlTypePrinter()
  ) {
    super(_option);
    if (this._option.model) {
      this.rootDataName = this._option.model;
    } else {
      this.rootDataName = 'Base';
    }
  }

  public execute(pattern: string): void {
    const files = glob.sync(pattern);
    for (const file of files) {
      console.info(`read ${file} ...`);
      this.parser.addJson(file, this.rootDataName);
    }
    const parseResult = this.parser.parse();
    this.printer.print(parseResult, this._option.output);
  }
}
