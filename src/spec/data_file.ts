import path from 'path';
import { SystemType, SubTypeName, SubType, SubTypeField } from './sub_type';
import { HasKey, DataTypeError, InvalidArgumentError } from '../common/base';
import { IDataFile } from './yml_type';
import { ObjectPath, ObjectPathNoArrayIndex } from '../common/base';

export class DataSubType {
  private _values = new Map<string, unknown>();
  similar: SimilarData | null = null;

  constructor(private _subType: SubType, readonly dataName: string, readonly parent: DataSubType | null = null) {}

  get subType(): SubType {
    return this._subType;
  }

  /**
   * SubTypeを最新化する
   *
   * json のデータは、すべてのプロパティを書かなくても、定義できる。
   * このインスタンスでのプロパティ構成が、別のインスタンスではプロパティが増えていることもある。
   * このメソッドは parser の処理過程で SubType が更新されたときに、呼び出される。
   *
   * @param subType
   */
  updateCachedSubType(subType: SubType) {
    this._subType = subType;
  }

  hasValue(fieldName: string): boolean {
    const val = this._values.get(fieldName);
    return val !== undefined ? true : false;
  }

  isArrayValue(fieldName: string): boolean {
    const val = this.getValue(fieldName);
    return Array.isArray(val);
  }

  private _getValue(fieldName: string): unknown {
    const val = this._values.get(fieldName);
    if (val === undefined) {
      throw new DataTypeError(`${this.subType.typeName.name} に ${fieldName} がない`);
    }
    return val;
  }

  getValue(fieldName: string): string | number | boolean {
    return this._getValue(fieldName) as string | number | boolean;
  }

  getArrayValue(fieldName: string): string[] | number[] | boolean[] {
    const vals = this._getValue(fieldName) as string[] | number[] | boolean[];
    if (!Array.isArray(vals)) {
      return [];
    }
    return vals;
  }

  getDataSubType(fieldName: string): DataSubType {
    return this._getValue(fieldName) as DataSubType;
  }

  getArrayDataSubType(fieldName: string): DataSubType[] {
    const vals = this._getValue(fieldName) as DataSubType[];
    if (!Array.isArray(vals)) {
      return [];
    }
    return vals;
  }

  /**
   * オブジェクトの内容が同じデータを similer のリンクリストを辿って取得する
   * similer がないものは、this を返す。
   * similer はあるが、diffValues が1つ以上あるものは、内容が同一ではないので、
   * その手前のオブジェクトを返す。
   */
  get similarAncesters(): DataSubType {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let dst: DataSubType = this;
    while (dst.similar != null) {
      if (dst.similar.diffValues.length > 0) {
        break;
      }
      dst = dst.similar.dataSubType;
    }
    return dst;
  }

  /**
   * 継承するオブジェクトを取得する
   * 継承対象は、直近の similar データだが、そのオブジェクトが差分のない類似を持っている場合は、
   * さらに遡って元を手繰り寄せる
   */
  get inheritDataSubType(): DataSubType {
    if (!this.similar) {
      throw new InvalidArgumentError();
    }
    const dst = this.similar.dataSubType;
    return dst.similarAncesters;
  }

  private _setValue(fieldName: string, val: unknown) {
    const field = this.subType.getField(fieldName);
    if (!field) {
      throw new InvalidArgumentError();
    }
    this._values.set(fieldName, val);
  }

  setNull(fieldName: string) {
    this._setValue(fieldName, null);
  }

  setValue(fieldName: string, val: string | number | boolean) {
    this._setValue(fieldName, val);
  }

  setArrayValue(fieldName: string, vals: string[] | number[] | boolean[]) {
    this._setValue(fieldName, vals);
  }

  setDataSubType(fieldName: string, val: DataSubType) {
    this._setValue(fieldName, val);
  }

  setArrayDataSubType(fieldName: string, vals: DataSubType[]) {
    this._setValue(fieldName, vals);
  }

  /**
   * 類似するデータを探して"再利用するコード"生成用のデータを作成する
   *
   * - キャッシュにある全データと比較して"一番"類似するデータを探す
   * - 見つかった類似データは target の similar にセットする
   *
   * 類似の仕様
   * - 同じ型である
   * - プリミティブな値を比較して異なる値の総プロパティ数が一番少ないものが、より類似するものと判定する
   * - 全プロパティが異なる場合、"再利用するコード"は冗長で無意味なものになるので類似候補にしない
   * - 配列の場合、配列数が異なる場合は、配列全体を差分として置き換え対象として相違数をカウントする
   *
   * @param target
   */
  updateSimilarData(target: DataSubType): SimilarData | null {
    if (this == target) {
      throw new InvalidArgumentError('this と target は比較してはいけない');
    }
    // 型が異なるものは比較しない
    if (!this.subType.compare(target.subType)) {
      return null;
    }
    let sameCount = 0;
    let notSameCount = 0;
    const diffValues: DiffValue[] = [];
    for (const field of this.subType.fields) {
      const hasTarget = target.hasValue(field.fieldName);
      const hasSrc = this.hasValue(field.fieldName);
      if (field.isArray) {
        if (field.isPrimitiveType || field.systemType == SystemType.Unknown) {
          if (!hasTarget || !hasSrc) {
            notSameCount++;
            const srcArray = !hasSrc ? [] : this.getArrayValue(field.fieldName);
            diffValues.push(new DiffArrayAllValues(field, srcArray));
          } else {
            const targetArray = target.getArrayValue(field.fieldName);
            const srcArray = this.getArrayValue(field.fieldName);
            if (targetArray.length != srcArray.length) {
              notSameCount += srcArray.length;
              diffValues.push(new DiffArrayAllValues(field, srcArray));
            } else {
              for (let i = 0; i < srcArray.length; i++) {
                if (srcArray[i] != targetArray[i]) {
                  notSameCount++;
                  diffValues.push(new DiffArrayValue(field, i, srcArray[i]));
                } else {
                  sameCount++;
                }
              }
            }
          }
        } else if (field.systemType == SystemType.Object) {
          if (!hasTarget || !hasSrc) {
            notSameCount++;
            const srcArray = !hasSrc ? null : this.getArrayDataSubType(field.fieldName);
            diffValues.push(new DiffArrayAllValues(field, srcArray));
          } else {
            const targetArray = target.getArrayDataSubType(field.fieldName);
            const srcArray = this.getArrayDataSubType(field.fieldName);
            if (targetArray.length != srcArray.length) {
              notSameCount += srcArray.length;
              diffValues.push(new DiffArrayAllValues(field, srcArray));
            } else {
              for (let i = 0; i < srcArray.length; i++) {
                const similar = srcArray[i].updateSimilarData(targetArray[i]);
                if (similar == null) {
                  throw new InvalidArgumentError(
                    `同じ field type なので、similar=null なのはおかしい: ${this.dataName}.${field.fieldName} / ${target.dataName}.${field.fieldName}`
                  );
                }
                if (similar.notSameCount != 0) {
                  notSameCount++;
                  diffValues.push(new DiffArrayValue(field, i, srcArray[i]));
                } else {
                  sameCount++;
                }
              }
            }
          }
        } else {
          throw new InvalidArgumentError(`unknown systemType: ${field.systemType}`);
        }
      } else if (field.isPrimitiveType || field.systemType == SystemType.Unknown) {
        if (!hasTarget || !hasSrc) {
          notSameCount++;
          const srcValue = !hasSrc ? null : this.getValue(field.fieldName);
          diffValues.push(new DiffArrayAllValues(field, srcValue));
        } else {
          if (target.getValue(field.fieldName) != this.getValue(field.fieldName)) {
            notSameCount++;
            diffValues.push(new DiffValue(field, this.getValue(field.fieldName)));
          } else {
            sameCount++;
          }
        }
      } else if (field.systemType == SystemType.Object) {
        if (!hasTarget || !hasSrc) {
          notSameCount++;
          const srcDataSubType = !hasSrc ? null : this.getDataSubType(field.fieldName);
          diffValues.push(new DiffValue(field, srcDataSubType));
        } else {
          const targetDataSubType = target.getDataSubType(field.fieldName);
          const srcDataSubType = this.getDataSubType(field.fieldName);
          const similar = srcDataSubType.updateSimilarData(targetDataSubType);
          if (similar == null) {
            throw new InvalidArgumentError(
              `同じ field type なので、similar=null なのはおかしい: ${this.dataName}.${field.fieldName} / ${targetDataSubType.dataName}.${field.fieldName}`
            );
          }
          if (similar.notSameCount != 0) {
            notSameCount++;
            diffValues.push(new DiffValue(field, srcDataSubType));
          } else {
            sameCount++;
          }
        }
      } else {
        throw new InvalidArgumentError(`unknown systemType: ${field.systemType}`);
      }
    }
    const similar = new SimilarData(target, diffValues, notSameCount, sameCount);
    // 全プロパティが異なる場合は類似とは言わないので、target.similar にはセットしない
    if (sameCount > 0 || notSameCount == 0) {
      if (!this.similar) {
        this.similar = similar;
      } else if (notSameCount <= this.similar.notSameCount) {
        this.similar = similar;
      }
    }
    return similar;
  }
}

export class DataFile implements HasKey {
  private _cacheFields = new Map<string, SubTypeField>();
  private _rootDataSubType: DataSubType | null = null;
  private _dataNames: Map<string, number> = new Map<string, number>();
  readonly dataSubTypes: DataSubType[] = [];

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

  get rootDataSubType(): DataSubType {
    if (this._rootDataSubType == null) {
      throw new InvalidArgumentError(`_dataSubType が設定されていない: ${this.file}`);
    }
    let dst = this._rootDataSubType;
    if (dst.similar != null && dst.similar.diffValues.length == 0) {
      dst = dst.similar.dataSubType;
    }
    return dst;
  }

  getField(opath: ObjectPath): SubTypeField | undefined {
    const pathsNoIndex = ObjectPathNoArrayIndex.fromObjectPath(opath);
    return this._cacheFields.get(pathsNoIndex.path);
  }

  setField(opath: ObjectPath, field: SubTypeField) {
    const pathsNoIndex = ObjectPathNoArrayIndex.fromObjectPath(opath);
    return this._cacheFields.set(pathsNoIndex.path, field);
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

  createDataSubType(subType: SubType, parent: DataSubType | null = null): DataSubType {
    const dst = new DataSubType(subType, this.generateDataName(subType), parent);
    if (this._rootDataSubType == null && parent == null) {
      this._rootDataSubType = dst;
    }
    this.dataSubTypes.push(dst);
    return dst;
  }

  toYml(): IDataFile {
    const y = {
      file: this.file,
      rootModel: this.rootModel,
      fieldTypeMap: {},
    } as IDataFile;
    for (const [fieldPath, fieldType] of Array.from(this._cacheFields.entries())) {
      y.fieldTypeMap[fieldPath] = fieldType.typeName;
    }
    return y;
  }

  private generateDataName(subType: SubType): string {
    let baseName = this.baseFile.replace(/\.json$/, '');
    baseName = baseName.replace(/[-.]/g, '_');
    baseName = `${baseName}_${subType.typeName.name}`;
    if (!this._dataNames.has(baseName)) {
      this._dataNames.set(baseName, 0);
    }
    let id = this._dataNames.get(baseName);
    if (id == undefined) {
      throw new InvalidArgumentError();
    }
    this._dataNames.set(baseName, ++id);
    return `${baseName}_${id}`;
  }
}

export class SimilarData {
  constructor(
    readonly dataSubType: DataSubType,
    readonly diffValues: DiffValue[],
    readonly notSameCount: number,
    readonly sameCount: number
  ) {}
}

export class DiffValue {
  constructor(readonly field: SubTypeField, readonly value: unknown) {}
}

export class DiffArrayValue extends DiffValue {
  constructor(readonly field: SubTypeField, readonly arrIindex: number, readonly value: unknown) {
    super(field, value);
  }
}

export class DiffArrayAllValues extends DiffArrayValue {
  constructor(readonly field: SubTypeField, readonly value: unknown) {
    super(field, -1, value);
  }
}
