import fs from 'fs';
import { DataFile, SimilarData } from '../spec/data_file';
import { SubType, SubTypeField, SystemType } from '../spec/sub_type';
import { Cache, InvalidArgumentError } from '../common/base';
import { IYmlDefinitions } from '../spec/yml_type';

export class JsonParseResult {
  private _dataFiles: Cache<DataFile> = new Cache<DataFile>();
  private _subTypes: Cache<SubType> = new Cache<SubType>();

  get dataFiles(): DataFile[] {
    return this._dataFiles.values();
  }

  putDataFile(dataFile: DataFile) {
    this._dataFiles.add(dataFile);
  }

  get subTypes(): SubType[] {
    return this._subTypes.values();
  }

  putSubType(subType: SubType) {
    const cached = this._subTypes.get(subType.typeName);
    if (cached) {
      if (cached.compare(subType)) {
        return;
      }
      cached.mergeFields(subType);
    } else {
      this._subTypes.add(subType);
    }
  }
}

export class JsonParser {
  private result = new JsonParseResult();

  constructor(readonly typeDefs: IYmlDefinitions | null) {}

  addJson(filePath: string, rootDataName: string) {
    const dataFile = this.createDataFile(filePath, rootDataName);
    this.result.putDataFile(dataFile);
  }

  parse() {
    for (const dataFile of this.result.dataFiles) {
      this.parseRawData(dataFile, dataFile.rawData);
    }
    for (const dataFile of this.result.dataFiles) {
      this.searchSimilarData(dataFile);
    }
    return this.result;
  }

  private createDataFile(filePath: string, rootDataName: string): DataFile {
    const text = fs.readFileSync(filePath, 'utf8');
    const rawData = JSON.parse(text) as Record<string, unknown>;
    return new DataFile(filePath, rawData, rootDataName);
  }

  private parseRawData(dataFile: DataFile, rawData: unknown, parentPath = '') {
    if (rawData == null) {
      throw new InvalidArgumentError(`null のデータは処理できない: ${dataFile.file} / ${parentPath}`);
    }
    const subType = dataFile.createSubType(parentPath);
    const records = rawData as Record<string, unknown>;
    for (const [key, val] of Object.entries(records)) {
      const fieldName = key;
      let paths = parentPath;
      if (parentPath != '') {
        paths += '.';
      }
      paths += fieldName;
      const field = SubTypeField.fromValue(fieldName, val);
      subType.addField(field);
      if (field.systemType == SystemType.Object) {
        if (field.isArray) {
          const data = val as any[];
          let i = 0;
          for (const datum of data) {
            this.parseRawData(dataFile, datum, `${paths}[${i}]`);
            i++;
          }
        } else {
          this.parseRawData(dataFile, val, paths);
        }
      } else {
        if (field.isArray) {
          const data = val as any[];
          let i = 0;
          for (const datum of data) {
            dataFile.fieldPathType.set(paths, field);
            dataFile.fieldPathVal.set(`${paths}[${i}]`, datum);
            i++;
          }
        } else {
          dataFile.fieldPathType.set(paths, field);
          dataFile.fieldPathVal.set(paths, val);
        }
      }
    }
    this.result.putSubType(subType);
  }

  // private correctDataStr() {
  //   const removed = new Set<string>();
  //   for (const subType of this._subTypes.values()) {
  //     if (subType.fields.length != 0) {
  //       continue;
  //     }
  //     removed.add(subType.typeName);
  //     for (const dataFile of this._dataFiles.values()) {
  //       for (const propType of Object.entries(dataFile.propType)) {
  //         const paths = propType[0];
  //         const typeName = propType[1];
  //         if (typeName.indexOf("[]*") == 0) {
  //         }
  //         if (subType.fields.length != 0) {
  //           continue;
  //         }
  //         removed.has(subType.typeName);
  //       }
  //     }
  //   }
  // }

  private searchSimilarData(target: DataFile) {
    let maxNotSame = target.fieldPathVal.size + 1;
    const similar = new SimilarData();
    for (const cached of this.result.dataFiles) {
      if (cached == target) {
        continue;
      }
      if (cached.similar != null) {
        continue;
      }
      if (cached.mainType == null) {
        throw new InvalidArgumentError(`${cached.file} には mainType がない`);
      }
      if (target.mainType == null) {
        throw new InvalidArgumentError(`${target.file} には mainType がない`);
      }
      if (!cached.mainType.compare(target.mainType)) {
        continue;
      }
      if (cached.fieldPathVal.size != target.fieldPathVal.size) {
        continue;
      }
      let notSame = 0;
      const diffPropPathVal = new Map<string, unknown>();
      for (const [key, val] of Object.entries(cached.fieldPathVal)) {
        if (target.fieldPathVal.get(key) != val) {
          notSame++;
          diffPropPathVal.set(key, target.fieldPathVal.get(key));
        }
      }
      if (notSame == target.fieldPathVal.size) {
        continue;
      }
      if (notSame < maxNotSame) {
        maxNotSame = notSame;
        similar.dataFile = cached;
        similar.diffPropPathVal = diffPropPathVal;
        // similar.dataStr = similarDataToStr(similar);
      }
    }
    if (similar.dataFile != null) {
      target.similar = similar;
    }
  }
}
