import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubTypeBase, SubTypeField, SystemType } from '../spec/sub_type';
import { DataSubType, DataFile, DiffArrayAllValues, DiffArrayValue } from '../spec/data_file';
import { InvalidArgumentError } from '../common/base';
import { JsonParseResult } from '../parser/parser';
import { Printer } from './base';
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
        t = `*${this.orgField.objectName}`;
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

  get dataId(): string {
    return this.makeDataId(this._dataSubType.dataName);
  }

  get similarDataId(): string {
    if (!this._dataSubType.similar) {
      throw new InvalidArgumentError();
    }
    return this.makeDataId(this._dataSubType.inheritDataSubType.dataName);
  }

  private makeDataId(dataName: string): string {
    return util.pascalCase(dataName);
  }

  private dataSubTypeToStr(): string {
    const goSubType = new GolangSubType(this._dataSubType.subType);
    let str = `${goSubType.typeName}{\n`;
    for (const goField of goSubType.fields) {
      const field = goField.orgField;
      if (!this._dataSubType.hasValue(field.fieldName)) {
        continue;
      }
      if (field.systemType == SystemType.Object) {
        if (field.isArray) {
          const dsTypes = this._dataSubType.getArrayDataSubType(field.fieldName);
          str += `${goField.fieldName}: ${goField.typeName}{\n`;
          for (const dst of dsTypes) {
            const dataId = this.makeDataId(dst.similarAncesters.dataName);
            str += `f.ChildNode(${dataId}).(*${dst.subType.typeName.name}),\n`;
          }
          str += '},\n';
        } else {
          const dst = this._dataSubType.getDataSubType(field.fieldName);
          const dataId = this.makeDataId(dst.similarAncesters.dataName);
          str += `${goField.fieldName}: f.ChildNode(${dataId}).(*${dst.subType.typeName.name}),\n`;
        }
      } else if (field.systemType == SystemType.Unknown) {
        if (field.isArray) {
          str += `${goField.fieldName}: ${goField.typeName}{},\n`;
        } else {
          str += `${goField.fieldName}: nil,\n`;
        }
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
      } else if (field.systemType == SystemType.Unknown) {
        if (field.isArray) {
          str += `data.${goField.fieldName} = ${goField.typeName}{}\n`;
        } else {
          str += `data.${goField.fieldName} = nil\n`;
        }
      } else if (field.systemType == SystemType.Object) {
        if (field.isArray) {
          if (diffValue instanceof DiffArrayAllValues) {
            const childrenDataSubType = diffValue.value as DataSubType[];
            if (childrenDataSubType == null) {
              str += `data.${goField.fieldName} = nil\n`;
            } else {
              str += `data.${goField.fieldName} = ${goField.typeName}{\n`;
              for (const childDst of childrenDataSubType) {
                const dataId = this.makeDataId(childDst.similarAncesters.dataName);
                if (childDst == null) {
                  str += 'nil,\n';
                } else {
                  str += `f.ChildNode(${dataId}).(*${childDst.subType.typeName.name}),\n`;
                }
              }
              str += '}\n';
            }
          } else if (diffValue instanceof DiffArrayValue) {
            const diffArrVal = diffValue;
            const childDst = diffValue.value as DataSubType;
            const dataId = this.makeDataId(childDst.similarAncesters.dataName);
            if (childDst == null) {
              str += `data.${goField.fieldName}[${diffArrVal.arrIindex}] = nil\n`;
            } else {
              str += `data.${goField.fieldName}[${diffArrVal.arrIindex}] = f.ChildNode(${dataId}).(*${childDst.subType.typeName.name})\n`;
            }
          } else {
            throw new InvalidArgumentError(`unknown instance type: ${typeof diffValue}`);
          }
        } else {
          const childDst = diffValue.value as DataSubType;
          const dataId = this.makeDataId(childDst.similarAncesters.dataName);
          if (childDst == null) {
            str += `data.${goField.fieldName} = nil\n`;
          } else {
            str += `data.${goField.fieldName} = f.ChildNode(${dataId}).(${childDst.subType.typeName.name})\n`;
          }
        }
      } else {
        throw new InvalidArgumentError(`systemType が不明: systemType=${field.systemType}`);
      }
    }
    return str;
  }

  private primitiveToStr(val: unknown): string {
    if (val == null) {
      return 'nil';
    }
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

  get rootDataId(): string {
    const goDataSubType = new GolangDataSubType(this._dataFile.rootDataSubType);
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

export class GolangPrinter implements Printer {
  constructor(private packageName: string) {}

  print(parseResult: JsonParseResult, outputPath: string) {
    const goSubTypes = [];
    for (const subType of parseResult.subTypes) {
      goSubTypes.push(new GolangSubType(subType));
    }
    const goDataSubTypes = [];
    for (const dst of parseResult.dataSubTypesSortedByRegistration) {
      goDataSubTypes.push(new GolangDataSubType(dst));
    }
    const goDataFiles = [];
    for (const dataFile of parseResult.dataFiles) {
      goDataFiles.push(new GolangDataFile(dataFile));
    }
    const data = {
      packageName: this.packageName,
      goCodePath: outputPath,
      jsonOutputDir: path.dirname(outputPath),
      goSubTypes: goSubTypes,
      goDataSubTypes: goDataSubTypes,
      goDataFiles: goDataFiles,
    };
    const template = `
// +build test

package <%= packageName %>

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

// データの識別子
const (
  <%_ goDataSubTypes.forEach((goDataSubType) => { _%>
    <%= goDataSubType.dataId %> DataID = "<%= goDataSubType.dataId %>"
  <%_ }); _%>
)

// データ登録
func RegisterData() {
	f := Factory
  <%_ goDataSubTypes.forEach((goDataSubType) => { _%>
    <%_ if (!goDataSubType.hasSimilar) { _%>
      f.Register(<%= goDataSubType.dataId %>, func() interface{} {
        return &<%- goDataSubType.modelStr _%>
      })
    <%_ } else { _%>
      f.Register(<%= goDataSubType.dataId %>, func() interface{} {
        data := f.InheritNode(<%= goDataSubType.similarDataId %>).(*<%- goDataSubType.returnTypeName _%>)
        <%- goDataSubType.reuseStr _%>
        return data
      })
    <%_ } _%>
  <%_ }); _%>
}

var TestData = map[string]DataID {
  <%_ goDataFiles.forEach((goDataFile) => { _%>
    "<%= goDataFile.baseFile %>": <%= goDataFile.rootDataId %>,
  <%_ }); _%>
}
`;
    const text = ejs.render(template, data, {});
    fs.writeFileSync(outputPath, text);
    execSync(`gofmt -w ${outputPath}`);
  }
}
