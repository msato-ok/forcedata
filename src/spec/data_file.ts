import path from 'path';
import { SubType, SubTypeField } from './sub_type';
import { HasKey, InvalidArgumentError } from '../common/base';
import { IDataFile } from './yml_type';

export class DataFile implements HasKey {
  readonly baseFile: string;
  // private _dataStr: string = ""

  fieldPathType = new Map<string, SubTypeField>();
  fieldPathVal = new Map<string, unknown>();
  similar: SimilarData | null = null;
  mainType: SubType | null = null;

  constructor(readonly file: string, readonly rawData: Record<string, unknown>, readonly rootDataName: string) {
    this.baseFile = path.basename(file);
  }

  get key(): string {
    return this.baseFile;
  }

  createSubType(jsonPath = ''): SubType {
    if (jsonPath == '') {
      this.mainType = new SubType(this.rootDataName);
      return this.mainType;
    } else {
      let typeName = jsonPath.split('.').pop();
      if (!typeName) {
        throw new InvalidArgumentError(
          `jsonPath が空文字以外の場合は、json のプロパティを "." 区切りで表現されている必要がある: jsonPath=${jsonPath}`
        );
      }
      // 末尾に hoge.fuga[0] と配列の添字が付いてる場合は削除する
      typeName = typeName.replace(/(.*?)\[.*/, '$1');
      return new SubType(typeName);
    }
  }

  // get dataStr(): string {
  //   return this._dataStr;
  // }

  toYml(): IDataFile {
    const y = {
      file: this.file,
      fieldTypeMap: {},
    } as IDataFile;
    for (const [fieldPath, fieldType] of Array.from(this.fieldPathType.entries())) {
      y.fieldTypeMap[fieldPath] = fieldType.typeName;
    }
    return y;
  }
}

export class SimilarData {
  dataFile: DataFile | null = null;
  diffPropPathVal = new Map<string, unknown>();
  // dataStr: string | null = null;
}
