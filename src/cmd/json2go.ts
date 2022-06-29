import { JsonCommand, AbstractCommandOption, ICommandOption } from './base';
import { JsonParser } from '../parser/parser';
import { GolangPrinter } from '../printer/golang';
import { IYmlDefinitions, load as loadYml } from '../spec/yml_type';
import glob from 'glob';
import path from 'path';

export interface IJsonToGoCommand extends ICommandOption {
  output: string;
  type: string;
  model: string;
  package: string;
}

export class JsonToGoCommand extends AbstractCommandOption implements JsonCommand {
  private rootDataName: string | null = null;
  private typeDefinitions: IYmlDefinitions | null = null;
  private parser: JsonParser;
  private printer: GolangPrinter;

  constructor(
    protected _option: IJsonToGoCommand,
    _parser: JsonParser | null = null,
    _printer: GolangPrinter | null = null
  ) {
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
    if (_printer == null) {
      let pkg = this._option.package;
      if (!pkg || pkg.length == 0) {
        const lastdir = path.dirname(this._option.output).split(path.sep).pop();
        if (!lastdir) {
          pkg = 'main';
        } else {
          pkg = lastdir;
        }
      }
      this.printer = new GolangPrinter(pkg);
    } else {
      this.printer = _printer;
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
