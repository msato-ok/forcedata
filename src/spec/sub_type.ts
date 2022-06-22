import { HasKey, InvalidArgumentError } from '../common/base';
import { IYmlSubType, IYmlSubTypeField } from './yml_type';
import * as util from '../common/util';

export class SubTypeBase {
  protected _fields: SubTypeField[] = [];
  readonly typeName: string;

  constructor(private _typeName: string) {
    this.typeName = util.pascalCase(_typeName);
  }

  get fields(): SubTypeField[] {
    return this._fields;
  }
}

export class SubType extends SubTypeBase implements HasKey {
  get key(): string {
    return this.typeName;
  }

  addField(field: SubTypeField) {
    this._fields.push(field);
  }

  resetFields() {
    this._fields = [];
  }

  mergeFields(target: SubType) {
    if (target.typeName != this.typeName) {
      throw new InvalidArgumentError(
        `type が異なるので merge できない left=${target.typeName}, right=${this.typeName}`
      );
    }
    const fields = new Map<string, SubTypeField>();
    for (const sf of this.fields) {
      fields.set(sf.fieldName, sf);
    }
    for (const tf of target.fields) {
      const sf = fields.get(tf.fieldName);
      if (sf) {
        // if (tf.fieldType != sf.fieldType) {
        //   throw new InvalidArgumentError(`type(${this.typeName}) の field(${sf.fieldName})の型が異なるので merge できない left=${tf.fieldType}, right=${sf.fieldType}`);
        // }
        continue;
      }
      fields.set(tf.fieldName, tf);
    }
    this.resetFields();
    for (const f of Array.from(fields.values())) {
      this.addField(f);
    }
  }

  compare(target: SubType): boolean {
    if (this.typeName != target.typeName) {
      return false;
    }
    if (this.fields.length != target.fields.length) {
      return false;
    }
    for (const sf of this.fields) {
      let field = null;
      for (const tf of target.fields) {
        if (sf.fieldName == tf.fieldName) {
          field = tf;
          break;
        }
      }
      if (field == null) {
        return false;
      }
      if (!sf.compare(field)) {
        return false;
      }
    }
    return true;
  }

  toYml(): IYmlSubType {
    const ymlSubType = {
      typeName: this.typeName,
      fields: [],
    } as IYmlSubType;
    for (const f of this.fields) {
      ymlSubType.fields.push(f.toYml());
    }
    return ymlSubType;
  }
}

export class SubTypeField implements HasKey {
  private _typeName: string;

  constructor(
    readonly fieldName: string,
    readonly systemType: SystemType,
    readonly objectName: string | null = null,
    readonly isArray: boolean = false
  ) {
    switch (systemType) {
      case SystemType.Bool:
      case SystemType.Int64:
      case SystemType.String:
      case SystemType.Unknown:
        this._typeName = systemType.toString();
        break;
      case SystemType.Object:
        if (!objectName) {
          throw new InvalidArgumentError('"SystemType.Object" where objectName is required');
        }
        this._typeName = objectName;
        break;
      default:
        throw new InvalidArgumentError(`unknown systemType: ${systemType}`);
    }
  }

  get typeName(): string {
    return this._typeName;
  }

  get key(): string {
    return this._typeName;
  }

  compare(target: SubTypeField): boolean {
    if (this.fieldName != target.fieldName) {
      return false;
    }
    // if (this.fieldType != target.fieldType) {
    //   return false;
    // }
    return true;
  }

  toYml(): IYmlSubTypeField {
    const yf = {
      fieldName: this.fieldName,
      systemType: this.systemType,
      objectName: this.objectName,
      isArray: this.isArray,
    } as IYmlSubTypeField;
    return yf;
  }

  static fromValue(fieldName: string, val: unknown): SubTypeField {
    if (val == null) {
      return new SubTypeField(fieldName, SystemType.Unknown);
    }
    const isArray = Array.isArray(val);
    if (isArray) {
      const records = val as any[];
      if (records.length == 0) {
        return new SubTypeField(fieldName, SystemType.Unknown, null, isArray);
      }
      val = records[0];
    }
    const systemType = getSystemType(val);
    if (systemType == SystemType.Object) {
      const objName = util.pascalCase(fieldName);
      return new SubTypeField(fieldName, systemType, objName, isArray);
    }
    return new SubTypeField(fieldName, systemType, null, isArray);
  }
}

export const SystemType = {
  Int64: 'Int64',
  String: 'String',
  Bool: 'Bool',
  Object: 'Object',
  Unknown: 'Unknown',
} as const;
export type SystemType = typeof SystemType[keyof typeof SystemType];

export function getSystemType(val: unknown): SystemType {
  if (val == null) {
    return SystemType.Unknown;
  }
  if (util.isString(val)) {
    return SystemType.String;
  }
  if (util.isNumber(val)) {
    return SystemType.Int64;
  }
  if (util.isBoolean(val)) {
    return SystemType.Bool;
  }
  if (util.isObject(val)) {
    return SystemType.Object;
  }
  throw new InvalidArgumentError();
}

export function isPrimitiveType(systemType: SystemType): boolean {
  return systemType == SystemType.String || systemType == SystemType.Int64 || systemType == SystemType.Bool;
}
