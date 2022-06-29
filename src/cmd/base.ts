export interface ICommandOption {
  verbose: boolean;
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
