import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubTypeName, SubTypeBase, SubTypeField, SystemType } from '../spec/sub_type';
import { DataFile } from '../spec/data_file';
import { InvalidArgumentError, ObjectPath } from '../common/base';
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

class GolangDataFile {
  readonly rootModelStr: string;
  readonly reuseStr: string;

  constructor(private _dataFile: DataFile, private _parseResult: JsonParseResult) {
    const rootModel = _parseResult.getSubType(new SubTypeName(_dataFile.rootModel));
    if (!rootModel) {
      throw new InvalidArgumentError(`rootModel が見つからない状態はあり得ない: ${_dataFile.rootModel}`);
    }
    this.rootModelStr = this.subTypeToStr(new GolangSubType(rootModel), ObjectPath.unique(''));
    this.reuseStr = this.similarToReuseStr();
  }

  get rootModel(): string {
    return this._dataFile.rootModel;
  }

  get file(): string {
    return this._dataFile.file;
  }

  get baseFile(): string {
    return this._dataFile.baseFile;
  }

  get funcName(): string {
    return this.makeFuncName(this._dataFile.baseFile);
  }

  private makeFuncName(baseFile: string): string {
    let fn = baseFile.replace(/\.json$/, '');
    fn = fn.replace(/[-.]/g, '_');
    return fn;
  }

  private subTypeToStr(goSubType: GolangSubType, opath: ObjectPath): string {
    let str = `${goSubType.typeName}{\n`;
    for (const goField of goSubType.fields) {
      const field = goField.orgField;
      const opathChild = opath.append(field.fieldName);
      const rawVal = this._dataFile.getValue(opathChild);
      if (rawVal === undefined) {
        throw new InvalidArgumentError(`rawVal が見つからない状態はありえない: opathChild=${opathChild.path}`);
      }
      if (field.systemType == SystemType.Object) {
        if (!field.objectName) {
          throw new InvalidArgumentError(`objectName が null な状態はありえない: opathChild=${goField.fieldName}`);
        }
        const subTypeChild = this._parseResult.getSubType(SubTypeName.fromString(field.objectName));
        if (!subTypeChild) {
          throw new InvalidArgumentError(`subTypeChild が見つからない状態はありえない: opathChild=${field.objectName}`);
        }
        if (field.isArray) {
          const data = rawVal as any[];
          let i = 0;
          str += `${goField.fieldName}: ${goField.typeName}{\n`;
          for (const datum of data) {
            const opathChildIdx = opathChild.appendArrayIndex(i);
            const childStr = this.subTypeToStr(new GolangSubType(subTypeChild), opathChildIdx);
            str += childStr.replace(/^[^{]+/, '');
            i++;
          }
          str += '},\n';
        } else {
          const childStr = this.subTypeToStr(new GolangSubType(subTypeChild), opathChild);
          str += `${goField.fieldName}: ${childStr}`;
        }
        continue;
      }
      if (field.systemType == SystemType.Unknown) {
        str += `${goField.fieldName}: nil,\n`;
        continue;
      }
      if (field.systemType == SystemType.Int64 || field.systemType == SystemType.Bool) {
        if (field.isArray) {
          const data = rawVal as any[];
          let i = 0;
          str += `${goField.fieldName}: ${goField.typeName}{\n`;
          for (const datum of data) {
            opathChild.appendArrayIndex(i);
            const n = datum as number;
            if (n >= Number.MAX_SAFE_INTEGER) {
              str += `float64(${datum}),\n`;
            } else {
              str += `${datum},\n`;
            }
            i++;
          }
          str += '},\n';
        } else {
          const n = rawVal as number;
          if (n >= Number.MAX_SAFE_INTEGER) {
            str += `${goField.fieldName}: float64(${rawVal}),\n`;
          } else {
            str += `${goField.fieldName}: ${rawVal},\n`;
          }
        }
      } else if (field.systemType == SystemType.String) {
        if (field.isArray) {
          const data = rawVal as any[];
          let i = 0;
          str += `${goField.fieldName}: ${goField.typeName}{\n`;
          for (const datum of data) {
            opathChild.appendArrayIndex(i);
            const escaped = JSON.stringify(datum);
            str += `${escaped},\n`;
            i++;
          }
          str += '},\n';
        } else {
          const escaped = JSON.stringify(rawVal);
          str += `${goField.fieldName}: ${escaped},\n`;
        }
      } else {
        throw new InvalidArgumentError(`systemType が不明: systemType=${field.systemType}`);
      }
    }
    if (opath.isRoot) {
      str += '}\n';
    } else {
      str += '},\n';
    }
    return str;
  }

  get hasSimilar(): boolean {
    return this._dataFile.similar ? true : false;
  }

  get similarFuncName(): string {
    if (!this._dataFile.similar) {
      return '';
    }
    return this.makeFuncName(this._dataFile.similar.dataFile.baseFile);
  }

  private opathToProps(opath: ObjectPath): string {
    const paths = opath.path.split('.');
    if (paths.length == 0) {
      return opath.path;
    }
    const subTypeName = new SubTypeName(this._dataFile.rootModel);
    const subType = this._parseResult.getSubType(subTypeName);
    const route = [];
    const routeConv = [];
    for (const path of paths) {
      if (!subType) {
        throw new InvalidArgumentError(`subType が見つからない: ${subTypeName.name}`);
      }
      route.push(path);
      const opathRoute = ObjectPath.unique(route.join('.'));
      const field = this._dataFile.getField(opathRoute);
      if (!field) {
        throw new InvalidArgumentError(`field が見つからない: ${route.join('.')}`);
      }
      const goFiled = new GolangSubTypeField(field);
      if (opathRoute.arrayIndex != undefined) {
        routeConv.push(`${goFiled.fieldName}[${opathRoute.arrayIndex}]`);
      } else {
        routeConv.push(goFiled.fieldName);
      }
    }
    return routeConv.join('.');
  }

  private similarToReuseStr(): string {
    if (!this._dataFile.similar) {
      return '';
    }
    let str = '';
    for (const path of Array.from(this._dataFile.similar.diffValues.keys())) {
      const opath = ObjectPath.unique(path);
      const field = this._dataFile.getField(opath);
      if (!field) {
        throw new InvalidArgumentError(`field が見つからない: ${path}`);
      }
      const val = this._dataFile.getValue(opath);
      const propsPath = this.opathToProps(opath);
      if (val === null) {
        str += `data.${propsPath} = nil`;
      } else if (field.systemType == SystemType.Unknown) {
        str += `data.${propsPath} = nil`;
      } else if (field.systemType == SystemType.Object) {
        continue;
      } else if (field.isPrimitiveType) {
        const primitiveToStr = (val: unknown) => {
          if (util.isString(val)) {
            return JSON.stringify(val);
          }
          const n = val as number;
          if (n >= Number.MAX_SAFE_INTEGER) {
            return `float64(${val})`;
          } else {
            return `${val}`;
          }
        };
        if (field.isArray) {
          const data = val as any[];
          const goField = new GolangSubTypeField(field);
          str += `data.${propsPath} = ${goField.typeName}{\n`;
          for (const datum of data) {
            const p = primitiveToStr(datum);
            str += `${p},\n`;
          }
          str += '}\n';
        } else {
          const p = primitiveToStr(val);
          str += `data.${propsPath} = ${p}\n`;
        }
      } else if (field.systemType == SystemType.String) {
        str += `data.${propsPath} = "${val}"\n`;
      } else {
        throw new InvalidArgumentError(`systemType が不明: systemType=${field.systemType}`);
      }
    }
    return str;
  }
}

export class GolangPrinter {
  print(parseResult: JsonParseResult, outputPath: string) {
    const goSubTypes = [];
    for (const subType of parseResult.subTypes) {
      goSubTypes.push(new GolangSubType(subType));
    }
    const goDataFiles = [];
    for (const dataFile of parseResult.dataFiles) {
      goDataFiles.push(new GolangDataFile(dataFile, parseResult));
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

<%_ goDataFiles.forEach((goDataFile) => { %>
  func <%= goDataFile.funcName %>() <%- goDataFile.rootModel _%> {
    <%_ if (!goDataFile.hasSimilar) { _%>
      return <%- goDataFile.rootModelStr _%>
    <%_ } else { _%>
      data := <%= goDataFile.similarFuncName %>()
      <%- goDataFile.reuseStr _%>
      return data
    <%_ } _%>
  }
<%_ }); _%>

var TestData = map[string]interface{} {
  <%_ goDataFiles.forEach((goDataFile) => { _%>
    "<%= goDataFile.baseFile %>": <%= goDataFile.funcName %>(),
  <%_ }); _%>
}
`;
    const text = ejs.render(
      template,
      {
        goCodePath: outputPath,
        jsonOutputDir: path.dirname(outputPath),
        goSubTypes: goSubTypes,
        goDataFiles: goDataFiles,
      },
      {}
    );
    fs.writeFileSync(outputPath, text);
    execSync(`gofmt -w ${outputPath}`);
  }
}
