import path from 'path';
import { SubTypeName, SubType, SubTypeField } from './sub_type';
import { HasKey } from '../common/base';
import { IDataFile } from './yml_type';
import { ObjectPath, ObjectPathNoArrayIndex } from '../common/base';

export class DataFile implements HasKey {
  private _cachefields = new Map<ObjectPathNoArrayIndex, SubTypeField>();
  private _cacheValues = new Map<ObjectPath, unknown>();

  readonly baseFile: string;

  similar: SimilarData | null = null;
  mainType: SubType | null = null;

  constructor(readonly file: string, readonly rawData: Record<string, unknown>, readonly rootDataName: string) {
    this.baseFile = path.basename(file);
  }

  get key(): string {
    return this.baseFile;
  }

  getField(opath: ObjectPath): SubTypeField | undefined {
    const pathsNoIndex = ObjectPathNoArrayIndex.fromObjectPath(opath);
    return this._cachefields.get(pathsNoIndex);
  }

  setField(opath: ObjectPath, field: SubTypeField) {
    const pathsNoIndex = ObjectPathNoArrayIndex.fromObjectPath(opath);
    return this._cachefields.set(pathsNoIndex, field);
  }

  getValue(opath: ObjectPath): unknown | undefined {
    return this._cacheValues.get(opath);
  }

  setValue(opath: ObjectPath, val: unknown) {
    return this._cacheValues.set(opath, val);
  }

  get objectPaths(): ObjectPath[] {
    return Array.from(this._cacheValues.keys());
  }

  createSubType(opath: ObjectPathNoArrayIndex): SubType {
    if (opath.isRoot) {
      this.mainType = new SubType(new SubTypeName(this.rootDataName));
      return this.mainType;
    } else {
      const typeName = SubTypeName.fromObjectPath(opath);
      return new SubType(typeName);
    }
  }

  toYml(): IDataFile {
    const y = {
      file: this.file,
      fieldTypeMap: {},
    } as IDataFile;
    for (const [fieldPath, fieldType] of Array.from(this._cachefields.entries())) {
      y.fieldTypeMap[fieldPath.path] = fieldType.typeName;
    }
    return y;
  }
}

export class SimilarData {
  dataFile: DataFile | null = null;
  diffPropPathVal = new Map<ObjectPath, unknown>();
}
