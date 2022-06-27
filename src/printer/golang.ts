import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubTypeBase, SubTypeField, SystemType } from '../spec/sub_type';
import { DataSubType, DataFile, DiffArrayAllValues, DiffArrayValue } from '../spec/data_file';
import { InvalidArgumentError } from '../common/base';
import { JsonParseResult } from '../parser/parser';
import * as util from '../common/util';
import path from 'path';

class GolangSubTypeField {
  readonly fieldName: string;

  constructor(readonly orgField: SubTypeField) {
    this.fieldName = util.pascalCase(orgField.fieldName);
  }

  get typeName(): string {
    let t: string;
    switch (this.orgField.systemType) {
      case SystemType.Bool:
        t = 'BoolOrNull';
        break;
      case SystemType.Int64:
        t = 'Int64OrNull';
        break;
      case SystemType.String:
        t = 'StringOrNull';
        break;
      case SystemType.Unknown:
        t = 'interface{}';
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
      t = `[]${t}`;
    }
    return t;
  }

  get jsonTag(): string {
    return '`' + `json:"${this.orgField.fieldName}"` + '`';
  }
}

class GolangSubType {
  private _goFields: GolangSubTypeField[] = [];

  constructor(private _orgSubTyp: SubTypeBase) {
    for (const field of _orgSubTyp.fields) {
      const goField = new GolangSubTypeField(field);
      this._goFields.push(goField);
    }
  }

  get typeName(): string {
    return this._orgSubTyp.typeName.name;
  }

  get fields(): GolangSubTypeField[] {
    return this._goFields;
  }
}

class GolangDataSubType {
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

  get funcName(): string {
    return this.makeFuncName(this._dataSubType.dataName);
  }

  get similarFuncName(): string {
    if (!this._dataSubType.similar) {
      throw new InvalidArgumentError();
    }
    return this.makeFuncName(this._dataSubType.similar.dataSubType.dataName);
  }

  private makeFuncName(dataName: string): string {
    return 'Get' + util.pascalCase(dataName);
  }

  private dataSubTypeToStr(): string {
    const goSubType = new GolangSubType(this._dataSubType.subType);
    let str = `${goSubType.typeName}{\n`;
    for (const goField of goSubType.fields) {
      const field = goField.orgField;
      if (field.systemType == SystemType.Object) {
        if (field.isArray) {
          const vals = this._dataSubType.getArrayDataSubType(field.fieldName);
          str += `${goField.fieldName}: ${goField.typeName}{\n`;
          for (const val of vals) {
            const dataFnc = this.makeFuncName(val.dataName);
            str += `${dataFnc}(),\n`;
          }
          str += '},\n';
        } else {
          const val = this._dataSubType.getDataSubType(field.fieldName);
          const dataFnc = this.makeFuncName(val.dataName);
          str += `${goField.fieldName}: ${dataFnc}(),\n`;
        }
      } else if (field.systemType == SystemType.Unknown) {
        str += `${goField.fieldName}: nil,\n`;
      } else if (field.isPrimitiveType) {
        if (field.isArray) {
          const vals = this._dataSubType.getArrayValue(field.fieldName);
          str += `${goField.fieldName}: ${goField.typeName}{\n`;
          for (const val of vals) {
            const pstr = this.primitiveToStr(val);
            str += `${pstr},\n`;
          }
          str += '},\n';
        } else {
          const val = this._dataSubType.getValue(field.fieldName);
          const pstr = this.primitiveToStr(val);
          str += `${goField.fieldName}: ${pstr},\n`;
        }
      } else {
        throw new InvalidArgumentError(`systemType が不明: systemType=${field.systemType}`);
      }
    }
    str += '}\n';
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
      const goField = new GolangSubTypeField(field);
      if (field.isPrimitiveType) {
        if (field.isArray) {
          if (diffValue instanceof DiffArrayAllValues) {
            const data = diffValue.value as string[] | number[] | boolean[];
            str += `data.${goField.fieldName} = ${goField.typeName}{\n`;
            for (const datum of data) {
              const p = this.primitiveToStr(datum);
              str += `${p},\n`;
            }
            str += '}\n';
          } else if (diffValue instanceof DiffArrayValue) {
            const diffArrVal = diffValue;
            const p = this.primitiveToStr(diffArrVal.value);
            str += `data.${goField.fieldName}[${diffArrVal.arrIindex}] = ${p}\n`;
          } else {
            throw new InvalidArgumentError(`unknown instance type: ${typeof diffValue}`);
          }
        } else {
          const p = this.primitiveToStr(diffValue.value);
          str += `data.${goField.fieldName} = ${p}\n`;
        }
      } else if (field.systemType == SystemType.Object) {
        if (field.isArray) {
          if (diffValue instanceof DiffArrayAllValues) {
            const childrenDataSubType = diffValue.value as DataSubType[];
            str += `data.${goField.fieldName} = []${goField.typeName}{\n`;
            for (const childDst of childrenDataSubType) {
              const fn = this.makeFuncName(childDst.dataName);
              str += `${fn}(),\n`;
            }
            str += '}\n';
          } else if (diffValue instanceof DiffArrayValue) {
            const diffArrVal = diffValue;
            const childDst = diffValue.value as DataSubType;
            const fn = this.makeFuncName(childDst.dataName);
            str += `data.${goField.fieldName}[${diffArrVal.arrIindex}] = ${fn}()\n`;
          } else {
            throw new InvalidArgumentError(`unknown instance type: ${typeof diffValue}`);
          }
        } else {
          const childDst = diffValue.value as DataSubType;
          const fn = this.makeFuncName(childDst.dataName);
          str += `data.${goField.fieldName} = ${fn}()\n`;
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
      return `float64(${val})`;
    } else {
      return `${val}`;
    }
  }
}

class GolangDataFile {
  constructor(private _dataFile: DataFile) {}

  get rootDataFuncName(): string {
    const goDataSubType = new GolangDataSubType(this._dataFile.rootDataSubType);
    return goDataSubType.funcName;
  }

  get file(): string {
    return this._dataFile.file;
  }

  get baseFile(): string {
    return this._dataFile.baseFile;
  }
}

export class GolangPrinter {
  print(parseResult: JsonParseResult, outputPath: string) {
    const goSubTypes = [];
    for (const subType of parseResult.subTypes) {
      goSubTypes.push(new GolangSubType(subType));
    }
    const goDataSubTypes = [];
    for (const subType of parseResult.dataSubTypes) {
      goDataSubTypes.push(new GolangDataSubType(subType));
    }
    const goDataFiles = [];
    for (const dataFile of parseResult.dataFiles) {
      goDataFiles.push(new GolangDataFile(dataFile));
    }
    const template = `
// +build test

package main

type StringOrNull interface{}
type Int64OrNull interface{}
type BoolOrNull interface{}

<%_ goSubTypes.forEach((goSubType) => { %>
type <%= goSubType.typeName %> struct {
  <%_ goSubType.fields.forEach((goField) => { _%>
    <%= goField.fieldName %> <%= goField.typeName %> <%- goField.jsonTag %>
  <%_ }); _%>
}
<% }); %>

<%_ goDataSubTypes.forEach((goDataSubType) => { %>
  func <%= goDataSubType.funcName %>() <%- goDataSubType.returnTypeName _%> {
    <%_ if (!goDataSubType.hasSimilar) { _%>
      return <%- goDataSubType.modelStr _%>
    <%_ } else { _%>
      data := <%= goDataSubType.similarFuncName %>()
      <%- goDataSubType.reuseStr _%>
      return data
    <%_ } _%>
  }
<%_ }); _%>

var TestData = map[string]interface{} {
  <%_ goDataFiles.forEach((goDataFile) => { _%>
    "<%= goDataFile.baseFile %>": <%= goDataFile.rootDataFuncName %>(),
  <%_ }); _%>
}
`;
    const text = ejs.render(
      template,
      {
        goCodePath: outputPath,
        jsonOutputDir: path.dirname(outputPath),
        goSubTypes: goSubTypes,
        goDataSubTypes: goDataSubTypes,
        goDataFiles: goDataFiles,
      },
      {}
    );
    fs.writeFileSync(outputPath, text);
    execSync(`gofmt -w ${outputPath}`);
  }
}
