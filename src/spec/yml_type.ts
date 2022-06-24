import { SystemType } from '../spec/sub_type';
import fs from 'fs';
import * as yaml from 'js-yaml';

export interface IYmlDefinitions {
  types: IYmlSubType[];
  dataFiles: IDataFile[];
}

export interface IDataFile {
  file: string;
  rootModel: string;
  fieldTypeMap: {
    [key: string]: string;
  };
}

export interface IYmlSubTypeField {
  fieldName: string;
  systemType: SystemType;
  objectName: string;
  isArray: boolean;
}

export interface IYmlSubType {
  typeName: string;
  fields: IYmlSubTypeField[];
}

export function load(filePath: string): IYmlDefinitions {
  const text = fs.readFileSync(filePath, 'utf8');
  return yaml.load(text) as IYmlDefinitions;
}

export function save(y: IYmlDefinitions, outputPath: string) {
  const text = yaml.dump(y);
  fs.writeFileSync(outputPath, text);
}
