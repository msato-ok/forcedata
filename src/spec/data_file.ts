import path from 'path';
import { SubTypeName, SubType, SubTypeField } from './sub_type';
import { HasKey } from '../common/base';
import { IDataFile } from './yml_type';
import { ObjectPath, ObjectPathNoArrayIndex } from '../common/base';

export class DataFile implements HasKey {
  private _cachefields = new Map<string, SubTypeField>();
  private _cacheValues = new Map<string, unknown>();

  readonly baseFile: string;
  readonly rootModel: string;

  similar: SimilarData | null = null;

  constructor(readonly file: string, readonly rawData: Record<string, unknown>, _rootModel: string | null) {
    this.rootModel = _rootModel == null ? 'Base' : _rootModel;
    this.baseFile = path.basename(file);
  }

  get key(): string {
    return this.baseFile;
  }

  getField(opath: ObjectPath): SubTypeField | undefined {
    const pathsNoIndex = ObjectPathNoArrayIndex.fromObjectPath(opath);
    return this._cachefields.get(pathsNoIndex.path);
  }

  setField(opath: ObjectPath, field: SubTypeField) {
    const pathsNoIndex = ObjectPathNoArrayIndex.fromObjectPath(opath);
    return this._cachefields.set(pathsNoIndex.path, field);
  }

  getValue(opath: ObjectPath): unknown | undefined {
    return this._cacheValues.get(opath.path);
  }

  setValue(opath: ObjectPath, val: unknown) {
    return this._cacheValues.set(opath.path, val);
  }

  get objectPaths(): ObjectPath[] {
    const paths = [];
    for (const path of Array.from(this._cacheValues.keys())) {
      paths.push(ObjectPath.unique(path));
    }
    return paths;
  }

  createSubType(opath: ObjectPathNoArrayIndex): SubType {
    let typeName;
    if (opath.isRoot) {
      typeName = new SubTypeName(this.rootModel);
    } else {
      typeName = SubTypeName.fromObjectPath(opath);
    }
    return new SubType(typeName);
  }

  toYml(): IDataFile {
    const y = {
      file: this.file,
      rootModel: this.rootModel,
      fieldTypeMap: {},
    } as IDataFile;
    for (const [fieldPath, fieldType] of Array.from(this._cachefields.entries())) {
      y.fieldTypeMap[fieldPath] = fieldType.typeName;
    }
    return y;
  }
}

export class SimilarData {
  constructor(readonly dataFile: DataFile, readonly diffValues: Map<string, unknown>) {}
}
