import fs from 'fs';
import { DataFile, SimilarData } from '../spec/data_file';
import { SubTypeName, SubType, SubTypeField, SystemType } from '../spec/sub_type';
import { ObjectPath, ObjectPathNoArrayIndex, Cache, InvalidArgumentError } from '../common/base';
import { IYmlDefinitions } from '../spec/yml_type';

export class JsonParseResult {
  private _dataFiles: Cache<DataFile> = new Cache<DataFile>();
  private _subTypes: Cache<SubType> = new Cache<SubType>();

  get dataFiles(): DataFile[] {
    return this._dataFiles.values();
  }

  loadTypeDefinitions(typeDefs: IYmlDefinitions) {
    for (const ymlSubType of typeDefs.types) {
      this.putSubType(SubType.fromYml(ymlSubType));
    }
  }

  putDataFile(dataFile: DataFile) {
    this._dataFiles.add(dataFile);
  }

  get subTypes(): SubType[] {
    return this._subTypes.values();
  }

  putSubType(subType: SubType) {
    const cached = this._subTypes.get(subType.key);
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

  constructor(readonly typeDefs: IYmlDefinitions | null) {
    if (typeDefs != null) {
      this.result.loadTypeDefinitions(typeDefs);
    }
  }

  addJson(filePath: string, rootDataName: string) {
    const dataFile = this.createDataFile(filePath, rootDataName);
    this.result.putDataFile(dataFile);
  }

  parse() {
    for (const dataFile of this.result.dataFiles) {
      this.parseRawData(dataFile, dataFile.rawData, ObjectPath.unique(''));
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

  private getOrCreateSubType(dataFile: DataFile, opath: ObjectPath): SubType {
    const opathN = ObjectPathNoArrayIndex.fromObjectPath(opath);
    if (this.typeDefs) {
      let firstSubType: SubType | null = null;
      for (const ymldf of this.typeDefs.dataFiles) {
        const typeName = ymldf.fieldTypeMap[opathN.path];
        if (typeName) {
          const subTypeName = SubTypeName.fromString(typeName);
          const subType = new SubType(subTypeName);
          if (dataFile.file == ymldf.file) {
            return subType;
          } else if (!firstSubType) {
            firstSubType = subType;
          }
        }
      }
      if (firstSubType) {
        return firstSubType;
      }
    }
    return dataFile.createSubType(opathN);
  }

  private parseRawData(dataFile: DataFile, rawData: unknown, parentPath: ObjectPath) {
    if (rawData == null) {
      throw new InvalidArgumentError(`null のデータは処理できない: ${dataFile.file} / ${parentPath}`);
    }
    const subType = this.getOrCreateSubType(dataFile, parentPath);
    const records = rawData as Record<string, unknown>;
    for (const [key, val] of Object.entries(records)) {
      const fieldName = key;
      const paths = parentPath.append(fieldName);
      const field = SubTypeField.fromValue(fieldName, val);
      subType.addField(field);
      if (field.systemType == SystemType.Object) {
        dataFile.setField(paths, field);
        if (field.isArray) {
          const data = val as any[];
          let i = 0;
          for (const datum of data) {
            this.parseRawData(dataFile, datum, paths.appendArrayIndex(i));
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
            const pathWithIndex = paths.appendArrayIndex(i);
            dataFile.setField(pathWithIndex, field);
            dataFile.setValue(pathWithIndex, datum);
            i++;
          }
        } else {
          dataFile.setField(paths, field);
          dataFile.setValue(paths, val);
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
    let maxNotSame = Number.MAX_SAFE_INTEGER;
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
      if (cached.objectPaths.length != target.objectPaths.length) {
        continue;
      }
      let notSame = 0;
      const diffPropPathVal = new Map<ObjectPath, unknown>();
      for (const opath of cached.objectPaths) {
        if (target.getValue(opath) != cached.getValue(opath)) {
          notSame++;
          diffPropPathVal.set(opath, target.getValue(opath));
        }
      }
      if (notSame == target.objectPaths.length) {
        continue;
      }
      if (notSame < maxNotSame) {
        maxNotSame = notSame;
        similar.dataFile = cached;
        similar.diffPropPathVal = diffPropPathVal;
      }
    }
    if (similar.dataFile != null) {
      target.similar = similar;
    }
  }
}
