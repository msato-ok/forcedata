import { JsonCommand, AbstractCommandOption, ICommandOption } from './base';
import { JsonParser } from '../parser/parser';
import { GolangPrinter } from '../printer/golang';
import { IYmlDefinitions, load as loadYml } from '../spec/yml_type';
import glob from 'glob';

export class JsonToGoCommand extends AbstractCommandOption implements JsonCommand {
  private rootDataName: string;
  private typeDefinitions: IYmlDefinitions | null = null;
  private parser: JsonParser;

  constructor(
    protected _option: ICommandOption,
    _parser: JsonParser | null = null,
    private printer: GolangPrinter = new GolangPrinter()
  ) {
    super(_option);
    if (this._option.model) {
      this.rootDataName = this._option.model;
    } else {
      this.rootDataName = 'Base';
    }
    if (this._option.type) {
      this.typeDefinitions = loadYml(this._option.type);
    }
    if (_parser == null) {
      this.parser = new JsonParser(this.typeDefinitions);
    } else {
      this.parser = _parser;
    }
  }

  public execute(pattern: string): void {
    const files = glob.sync(pattern);
    for (const file of files) {
      console.info(`read ${file} ...\n`);
      this.parser.addJson(file, this.rootDataName);
    }
    const parseResult = this.parser.parse();
    this.printer.print(parseResult, this._option.output);
  }
}
