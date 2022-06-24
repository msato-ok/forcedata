import fs from 'fs';
import { DataFile, SimilarData } from '../spec/data_file';
import { SubTypeName, SubType, SubTypeField, SystemType } from '../spec/sub_type';
import { ObjectPath, ObjectPathNoArrayIndex, Cache, InvalidArgumentError, ValidationError } from '../common/base';
import { IYmlDefinitions, IDataFile } from '../spec/yml_type';

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
    for (const subType of this._subTypes.values()) {
      for (const f of subType.fields) {
        if (f.systemType == SystemType.Object) {
          if (!this._subTypes.get(f.typeName)) {
            throw new ValidationError(`${subType.typeName.name}.${f.fieldName} の ${f.objectName} 型は未定義です`);
          }
        }
      }
    }
  }

  putDataFile(dataFile: DataFile) {
    this._dataFiles.add(dataFile);
  }

  getSubType(typeName: SubTypeName): SubType | undefined {
    return this._subTypes.get(typeName.name);
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

  addJson(filePath: string, rootDataName: string | null) {
    const dataFile = this.createDataFile(filePath, rootDataName);
    this.result.putDataFile(dataFile);
  }

  parse() {
    for (const dataFile of this.result.dataFiles) {
      this.parseRawData(dataFile, dataFile.rawData, ObjectPath.unique(''));
    }
    const revDataFiles = [...this.result.dataFiles];
    revDataFiles.reverse();
    for (const dataFile of revDataFiles) {
      this.searchSimilarData(dataFile);
    }
    return this.result;
  }

  private createDataFile(filePath: string, rootDataName: string | null): DataFile {
    const text = fs.readFileSync(filePath, 'utf8');
    const rawData = JSON.parse(text) as Record<string, unknown>;
    let firstDataFile: IDataFile | null = null;
    if (this.typeDefs) {
      for (const ymldf of this.typeDefs.dataFiles) {
        if (filePath == ymldf.file) {
          firstDataFile = ymldf;
        } else if (!firstDataFile) {
          firstDataFile = ymldf;
        }
      }
    }
    if (firstDataFile != null) {
      rootDataName = firstDataFile.rootModel;
    }
    return new DataFile(filePath, rawData, rootDataName);
  }

  private getOrCreateSubType(dataFile: DataFile, opath: ObjectPath): SubType {
    const opathN = ObjectPathNoArrayIndex.fromObjectPath(opath);
    if (this.typeDefs) {
      let firstSubType: SubType | null = null;
      for (const ymldf of this.typeDefs.dataFiles) {
        const typeName = ymldf.fieldTypeMap[opathN.path];
        if (typeName) {
          const subType = new SubType(SubTypeName.fromString(typeName));
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

  private getOrCreateField(dataFile: DataFile, opath: ObjectPath, fieldName: string, val: unknown): SubTypeField {
    const defaultField = SubTypeField.fromValue(fieldName, val);
    const opathN = ObjectPathNoArrayIndex.fromObjectPath(opath);
    if (this.typeDefs) {
      let firstField: SubTypeField | null = null;
      for (const ymldf of this.typeDefs.dataFiles) {
        const typeName = ymldf.fieldTypeMap[opathN.path];
        if (typeName) {
          const filed = SubTypeField.fromType(fieldName, typeName, defaultField.isArray);
          if (dataFile.file == ymldf.file) {
            return filed;
          } else if (!firstField) {
            firstField = filed;
          }
        }
      }
      if (firstField) {
        return firstField;
      }
    }
    return defaultField;
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
      const field = this.getOrCreateField(dataFile, paths, fieldName, val);
      subType.addField(field);
      dataFile.setField(paths, field);
      dataFile.setValue(paths, val);
      if (field.systemType == SystemType.Object) {
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
            dataFile.setValue(pathWithIndex, datum);
            i++;
          }
        }
      }
    }
    this.result.putSubType(subType);
  }

  private searchSimilarData(target: DataFile) {
    let maxNotSame = Number.MAX_SAFE_INTEGER;
    let similar: SimilarData | null = null;
    for (const cached of this.result.dataFiles) {
      if (cached == target) {
        continue;
      }
      if (cached.similar != null) {
        continue;
      }
      const cachedSubType = this.result.getSubType(new SubTypeName(cached.rootModel));
      if (!cachedSubType) {
        throw new InvalidArgumentError(`${cached.file} には rootModel がない`);
      }
      const targetSubType = this.result.getSubType(new SubTypeName(target.rootModel));
      if (targetSubType == null) {
        throw new InvalidArgumentError(`${target.file} には rootModel がない`);
      }
      if (!cachedSubType.compare(targetSubType)) {
        continue;
      }
      let notSame = 0;
      const diffValues = new Map<string, unknown>();
      for (const opath of cached.objectPaths) {
        const field = target.getField(opath);
        if (!field) {
          throw new InvalidArgumentError(`${target.file} には ${opath.path} はない`);
        }
        if (field.isArray && opath.arrayIndex === undefined) {
          continue;
        }
        if (target.getValue(opath) != cached.getValue(opath)) {
          notSame++;
          diffValues.set(opath.path, target.getValue(opath));
        }
      }
      if (notSame == target.objectPaths.length) {
        continue;
      }
      if (notSame < maxNotSame) {
        maxNotSame = notSame;
        similar = new SimilarData(cached, diffValues);
      }
    }
    if (similar) {
      target.similar = similar;
    }
  }
}
