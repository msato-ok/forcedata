import { JsonParseResult } from '../parser/parser';
import { IYmlDefinitions, save as saveYml } from '../spec/yml_type';

export class YmlTypePrinter {
  print(parseResult: JsonParseResult, output: string) {
    const definitions = {
      types: [],
      dataFiles: [],
    } as IYmlDefinitions;
    for (const subType of parseResult.subTypes) {
      definitions.types.push(subType.toYml());
    }
    for (const df of parseResult.dataFiles) {
      definitions.dataFiles.push(df.toYml());
    }
    saveYml(definitions, output);
  }
}
