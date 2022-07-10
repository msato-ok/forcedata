import glob from 'glob';
import { JsonParser } from '../parser/parser';
import { IYmlDefinitions, load as loadYml } from '../spec/yml_type';
import { Printer } from '../printer/base';

export interface ICommandOption {
  verbose: boolean;
}

export interface IJsonToPgCodeCommandOpt extends ICommandOption {
  output: string;
  type: string;
  model: string;
  package: string;
}

export interface JsonCommand {
  get option(): ICommandOption;
  execute(pattern: string): void;
}

export abstract class AbstractCommandOption {
  constructor(protected _option: ICommandOption) {}

  get option(): ICommandOption {
    return this._option;
  }
}

export abstract class AbstractPgCodeCommand extends AbstractCommandOption {
  protected rootDataName: string | null = null;
  protected typeDefinitions: IYmlDefinitions | null = null;
  protected parser: JsonParser;
  protected printer: Printer;

  constructor(protected _option: IJsonToPgCodeCommandOpt, _parser: JsonParser | null = null, _printer: Printer) {
    super(_option);
    if (this._option.model) {
      this.rootDataName = this._option.model;
    }
    if (this._option.type) {
      this.typeDefinitions = loadYml(this._option.type);
    }
    if (_parser == null) {
      this.parser = new JsonParser(this.typeDefinitions);
    } else {
      this.parser = _parser;
    }
    this.printer = _printer;
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
