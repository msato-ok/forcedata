import fs from 'fs';
import { DataSubType, DataFile } from '../spec/data_file';
import { SubTypeName, SubType, SubTypeField, SystemType } from '../spec/sub_type';
import { ObjectPath, ObjectPathNoArrayIndex, Cache, InvalidArgumentError, ValidationError } from '../common/base';
import { IYmlDefinitions, IDataFile } from '../spec/yml_type';

export class JsonParseResult {
  private _dataFiles: Cache<DataFile> = new Cache<DataFile>();
  private _subTypes: Cache<SubType> = new Cache<SubType>();

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

  get dataFiles(): DataFile[] {
    return this._dataFiles.values();
  }

  putDataFile(dataFile: DataFile) {
    this._dataFiles.add(dataFile);
  }

  /**
   * DataSubType が属する DataFile を取得する
   *
   * dst が json ファイル内でのルートモデルである場合に、それが属する DataFile を返す
   * ルートモデルではない場合 null を返す
   *
   * @param dsts
   * @returns
   */
  getDataFilesByDataSubType(dsts: DataSubType[]): DataFile[] {
    const dfList = [];
    for (const df of this._dataFiles.values()) {
      for (const dst of dsts) {
        if (df.rootDataSubType == dst) {
          dfList.push(df);
        }
      }
    }
    return dfList;
  }

  getSubType(typeName: SubTypeName): SubType {
    const s = this._subTypes.get(typeName.name);
    if (!s) {
      throw new InvalidArgumentError(`${typeName.name} がない`);
    }
    return s;
  }

  putSubType(subType: SubType): SubType {
    const cached = this._subTypes.get(subType.key);
    if (cached) {
      if (cached.compare(subType)) {
        return cached;
      }
      cached.mergeFields(subType);
      return cached;
    } else {
      this._subTypes.add(subType);
      return subType;
    }
  }

  get subTypes(): SubType[] {
    return this._subTypes.values();
  }

  /**
   * ユニークなデータを取得する
   *
   * オブジェクトのデータは、中身が同じものを除外してユニークなものだけを抽出する。
   * similar があり、且つ、差分が 0 のデータは、中身が同じであることを意味する。
   */
  get uniqueDataSubTypes(): DataSubType[] {
    const list: DataSubType[] = [];
    for (const dataFile of this.dataFiles) {
      for (const dst of dataFile.dataSubTypes) {
        if (dst.similar != null && dst.similar.diffValues.length == 0) {
          continue;
        }
        list.push(dst);
      }
    }
    return list;
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

  parse(): JsonParseResult {
    for (const dataFile of this.result.dataFiles) {
      this.parseRawData(dataFile, dataFile.rawData, ObjectPath.unique(''));
    }
    const revDataSubTypes = [...this.result.uniqueDataSubTypes];
    revDataSubTypes.reverse();
    for (let i = 0; i < revDataSubTypes.length; i++) {
      const src = revDataSubTypes[i];
      for (let j = i + 1; j < revDataSubTypes.length; j++) {
        const target = revDataSubTypes[j];
        src.updateSimilarData(target);
      }
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

  private parseRawData(dataFile: DataFile, rawData: unknown, parentPath: ObjectPath): DataSubType {
    if (rawData == null) {
      throw new InvalidArgumentError(`null のデータは処理できない: ${dataFile.file} / ${parentPath}`);
    }
    const subType = this.getOrCreateSubType(dataFile, parentPath);
    const dataSubType = dataFile.createDataSubType(subType);
    const records = rawData as Record<string, unknown>;
    for (const [key, val] of Object.entries(records)) {
      const fieldName = key;
      const paths = parentPath.append(fieldName);
      const field = this.getOrCreateField(dataFile, paths, fieldName, val);
      subType.addField(field);
      dataFile.setField(paths, field);
      if (field.systemType == SystemType.Object) {
        if (field.isArray) {
          const children: DataSubType[] = [];
          const data = val as any[];
          let i = 0;
          for (const datum of data) {
            const child = this.parseRawData(dataFile, datum, paths.appendArrayIndex(i));
            children.push(child);
            i++;
          }
          dataSubType.setArrayDataSubType(fieldName, children);
        } else {
          const child = this.parseRawData(dataFile, val, paths);
          dataSubType.setDataSubType(fieldName, child);
        }
      } else if (field.isPrimitiveType) {
        if (field.isArray) {
          const data = val as string[] | number[] | boolean[];
          dataSubType.setArrayValue(fieldName, data);
        } else {
          const data = val as string | number | boolean;
          dataSubType.setValue(fieldName, data);
        }
      } else if (field.systemType == SystemType.Unknown) {
        dataSubType.setNull(fieldName);
      } else {
        throw new InvalidArgumentError(`unknown systemType: ${field.fieldName} ${field.systemType}`);
      }
    }
    const cachedSubType = this.result.putSubType(subType);
    dataSubType.updateCachedSubType(cachedSubType);
    return dataSubType;
  }
}
