import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubTypeBase, SubTypeField, SystemType } from '../spec/sub_type';
import { DataSubType, DataFile, DiffArrayAllValues, DiffArrayValue } from '../spec/data_file';
import { InvalidArgumentError } from '../common/base';
import { JsonParseResult } from '../parser/parser';
import * as util from '../common/util';
import path from 'path';

class TsSubTypeField {
  readonly fieldName: string;

  constructor(readonly orgField: SubTypeField) {
    this.fieldName = orgField.fieldName;
  }

  get typeName(): string {
    let t: string;
    switch (this.orgField.systemType) {
      case SystemType.Bool:
        t = 'boolean';
        break;
      case SystemType.Int64:
        t = 'number';
        break;
      case SystemType.String:
        t = 'string';
        break;
      case SystemType.Unknown:
        t = 'unknown';
        break;
      case SystemType.Object:
        if (!this.orgField.objectName) {
          throw new InvalidArgumentError('"SystemType.Object" where objectName is required');
        }
        t = this.orgField.objectName;
        break;
      default:
        throw new InvalidArgumentError(`unknown systemType: ${this.orgField.systemType}`);
    }
    if (this.orgField.isArray) {
      t = `${t}[]`;
    }
    return t;
  }
}

class TsSubType {
  private _tsFields: TsSubTypeField[] = [];

  constructor(private _orgSubTyp: SubTypeBase) {
    for (const field of _orgSubTyp.fields) {
      const tsField = new TsSubTypeField(field);
      this._tsFields.push(tsField);
    }
  }

  get isEmptyField(): boolean {
    if (this._tsFields.length == 0) {
      return true;
    }
    return false;
  }

  get typeName(): string {
    return this._orgSubTyp.typeName.name;
  }

  get fields(): TsSubTypeField[] {
    return this._tsFields;
  }
}

class TsDataSubType {
  readonly modelStr: string;
  readonly reuseStr: string;

  constructor(private _dataSubType: DataSubType) {
    this.modelStr = '';
    this.reuseStr = '';
    if (_dataSubType.similar == null) {
      this.modelStr += this.dataSubTypeToStr();
    } else {
      this.reuseStr = this.similarToReuseStr();
    }
  }

  get returnTypeName(): string {
    return this._dataSubType.subType.typeName.name;
  }

  get dataId(): string {
    return this.makeDataId(this._dataSubType.dataName);
  }

  get similarDataId(): string {
    if (!this._dataSubType.similar) {
      throw new InvalidArgumentError();
    }
    return this.makeDataId(this._dataSubType.similar.dataSubType.dataName);
  }

  private makeDataId(dataName: string): string {
    return util.snakeCase(dataName).toUpperCase();
  }

  private dataSubTypeToStr(): string {
    const tsSubType = new TsSubType(this._dataSubType.subType);
    let str = '{\n';
    for (const tsField of tsSubType.fields) {
      const field = tsField.orgField;
      if (!this._dataSubType.hasValue(field.fieldName)) {
        continue;
      }
      if (field.systemType == SystemType.Object) {
        if (field.isArray) {
          const dsTypes = this._dataSubType.getArrayDataSubType(field.fieldName);
          str += `${tsField.fieldName}: [\n`;
          for (const dst of dsTypes) {
            if (dst.similar == null) {
              const dataId = this.makeDataId(dst.dataName);
              str += `f.childNode(DATAID.${dataId}) as ${dst.subType.typeName.name},\n`;
            } else {
              const dataId = this.makeDataId(dst.similar.dataSubType.dataName);
              str += `f.childNode(DATAID.${dataId}) as ${dst.subType.typeName.name},\n`;
            }
          }
          str += '],\n';
        } else {
          const val = this._dataSubType.getDataSubType(field.fieldName);
          const dataId = this.makeDataId(val.dataName);
          str += `${tsField.fieldName}: f.childNode(DATAID.${dataId}) as ${val.subType.typeName.name},\n`;
        }
      } else if (field.systemType == SystemType.Unknown) {
        str += `${tsField.fieldName}: null,\n`;
      } else if (field.isPrimitiveType) {
        if (field.isArray) {
          const vals = this._dataSubType.getArrayValue(field.fieldName);
          str += `${tsField.fieldName}: [\n`;
          for (const val of vals) {
            const pstr = this.primitiveToStr(val);
            str += `${pstr},\n`;
          }
          str += '],\n';
        } else {
          const val = this._dataSubType.getValue(field.fieldName);
          const pstr = this.primitiveToStr(val);
          str += `${tsField.fieldName}: ${pstr},\n`;
        }
      } else {
        throw new InvalidArgumentError(`systemType が不明: systemType=${field.systemType}`);
      }
    }
    str += `} as ${tsSubType.typeName}\n`;
    return str;
  }

  get hasSimilar(): boolean {
    return this._dataSubType.similar ? true : false;
  }

  private similarToReuseStr(): string {
    if (!this._dataSubType.similar) {
      return '';
    }
    let str = '';
    for (const diffValue of this._dataSubType.similar.diffValues) {
      const field = diffValue.field;
      const tsField = new TsSubTypeField(field);
      if (field.isPrimitiveType) {
        if (field.isArray) {
          if (diffValue instanceof DiffArrayAllValues) {
            const data = diffValue.value as string[] | number[] | boolean[];
            str += `data.${tsField.fieldName} = [\n`;
            for (const datum of data) {
              const p = this.primitiveToStr(datum);
              str += `${p},\n`;
            }
            str += ']\n';
          } else if (diffValue instanceof DiffArrayValue) {
            const diffArrVal = diffValue;
            const p = this.primitiveToStr(diffArrVal.value);
            str += `data.${tsField.fieldName}[${diffArrVal.arrIindex}] = ${p}\n`;
          } else {
            throw new InvalidArgumentError(`unknown instance type: ${typeof diffValue}`);
          }
        } else {
          const p = this.primitiveToStr(diffValue.value);
          str += `data.${tsField.fieldName} = ${p}\n`;
        }
      } else if (field.systemType == SystemType.Object) {
        if (field.isArray) {
          if (diffValue instanceof DiffArrayAllValues) {
            const childrenDataSubType = diffValue.value as DataSubType[];
            str += `data.${tsField.fieldName} = [\n`;
            for (const childDst of childrenDataSubType) {
              const dataId = this.makeDataId(childDst.similarAncesters.dataName);
              str += `f.childNode(DATAID.${dataId}) as ${childDst.subType.typeName.name},\n`;
            }
            str += ']\n';
          } else if (diffValue instanceof DiffArrayValue) {
            const diffArrVal = diffValue;
            const childDst = diffValue.value as DataSubType;
            const dataId = this.makeDataId(childDst.similarAncesters.dataName);
            str += `data.${tsField.fieldName}[${diffArrVal.arrIindex}] = f.childNode(DATAID.${dataId}) as ${childDst.subType.typeName.name}\n`;
          } else {
            throw new InvalidArgumentError(`unknown instance type: ${typeof diffValue}`);
          }
        } else {
          const childDst = diffValue.value as DataSubType;
          const dataId = this.makeDataId(childDst.similarAncesters.dataName);
          str += `data.${tsField.fieldName} = f.childNode(DATAID.${dataId}) as ${childDst.subType.typeName.name}\n`;
        }
      } else {
        throw new InvalidArgumentError(`systemType が不明: systemType=${field.systemType}`);
      }
    }
    return str;
  }

  private primitiveToStr(val: unknown): string {
    if (util.isString(val)) {
      return JSON.stringify(val);
    }
    const n = val as number;
    if (n >= Number.MAX_SAFE_INTEGER) {
      return `${val}`;
    } else {
      return `${val}`;
    }
  }
}

class TsDataFile {
  constructor(private _dataFile: DataFile) {}

  get rootDataId(): string {
    const goDataSubType = new TsDataSubType(this._dataFile.rootDataSubType);
    return goDataSubType.dataId;
  }

  get rootSubTypeName(): string {
    return this._dataFile.rootDataSubType.subType.typeName.name;
  }

  get file(): string {
    return this._dataFile.file;
  }

  get baseFile(): string {
    return this._dataFile.baseFile;
  }
}

export class TsPrinter {
  constructor(private packageName: string) {}

  print(parseResult: JsonParseResult, outputPath: string) {
    const tsSubTypes = [];
    for (const subType of parseResult.subTypes) {
      tsSubTypes.push(new TsSubType(subType));
    }
    const tsDataSubTypes = [];
    for (const dst of parseResult.dataSubTypesSortedByRegistration) {
      tsDataSubTypes.push(new TsDataSubType(dst));
    }
    const tsDataFiles = [];
    for (const dataFile of parseResult.dataFiles) {
      tsDataFiles.push(new TsDataFile(dataFile));
    }
    const data = {
      packageName: this.packageName,
      outputPath: outputPath,
      jsonOutputDir: path.dirname(outputPath),
      tsSubTypes: tsSubTypes,
      tsDataSubTypes: tsDataSubTypes,
      tsDataFiles: tsDataFiles,
    };
    const template = `
import { factory } from './factory';

<%_ tsSubTypes.forEach((tsSubType) => { %>
  <%_ if (tsSubType.isEmptyField) { _%>
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
  <%_ } _%>
  export interface <%= tsSubType.typeName %> {
    <%_ tsSubType.fields.forEach((tsField) => { _%>
      <%= tsField.fieldName %>: <%= tsField.typeName %>
    <%_ }); _%>
  }
<% }); %>

// データの識別子
export type MyDataId =
<%_ tsDataSubTypes.forEach((goDataSubType, index) => { _%>
  <%- (index > 0 ? '| ': '  ') + "'" + goDataSubType.dataId + "'" %>
<%_ }); _%>
;
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DATAID {
  <%_ tsDataSubTypes.forEach((goDataSubType) => { _%>
    export const <%= goDataSubType.dataId %>: MyDataId = '<%= goDataSubType.dataId %>';
  <%_ }); _%>
}

// データ登録
export function registerData() {
	const f = factory;
  <%_ tsDataSubTypes.forEach((goDataSubType) => { _%>
    <%_ if (!goDataSubType.hasSimilar) { _%>
      f.register(DATAID.<%= goDataSubType.dataId %>, () => {
        return <%- goDataSubType.modelStr _%>
      });
    <%_ } else { _%>
      f.register(DATAID.<%= goDataSubType.dataId %>, () => {
        const data = f.inheritNode(DATAID.<%= goDataSubType.similarDataId %>) as <%- goDataSubType.returnTypeName _%>;
        <%- goDataSubType.reuseStr _%>
        return data;
      });
    <%_ } _%>
  <%_ }); _%>
}

export const TestData = {
  <%_ tsDataFiles.forEach((goDataFile) => { _%>
    "<%= goDataFile.baseFile %>": DATAID.<%= goDataFile.rootDataId %>,
  <%_ }); _%>
};
`;
    const text = ejs.render(template, data, {});
    fs.writeFileSync(outputPath, text);
    execSync(`eslint ${outputPath} --fix`);
  }
}
