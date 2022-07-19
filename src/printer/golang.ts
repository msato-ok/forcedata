import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubType, SubTypeField, SystemType } from '../spec/sub_type';
import { DataSubType } from '../spec/data_file';
import { InvalidArgumentError } from '../common/base';
import { Segment } from '../parser/segmenter';
import { Printer } from './base';
import {
  ProgramCode,
  ObjectItemId,
  ProgramCodeConverter,
  SubTypeFieldFragment,
  FactoryRegistrationFragment,
  ObjectItemFragment,
  ObjectArrayFragment,
  ObjectArrayFullFragment,
  PrimitiveItemFragment,
  PrimitiveArrayFragment,
  PrimitiveArrayFullFragment,
  UnknownItemFragment,
  UnknownArrayFragment,
  AbstractProgramCodeConverter,
  FactoryRegistrationInheritFragment,
} from './converter';
import * as util from '../common/util';
import path from 'path';

export class GolangPrinter implements Printer {
  private _converter: ProgramCodeConverter;

  constructor(readonly converter: ProgramCodeConverter | null = null) {
    if (converter) {
      this._converter = converter;
    } else {
      this._converter = new GolangCodeConverter();
    }
  }

  print(segments: Segment[], outputDir: string) {
    const pc = this._converter.convert(segments);
    this.printModel(pc, path.join(outputDir, 'model/model.go'));
    this.printData(pc, outputDir);
    for (const rgf of pc.registrationGroupFragments) {
      for (const subTypeName of rgf.subTypeNames) {
        const dataIds = rgf.getDataIdsGroupBySubType(subTypeName);
        const fragments = rgf.getFragmentsGroupBySubType(subTypeName);
        this.printFragmentsGroupBySubType(subTypeName, dataIds, fragments, outputDir, rgf.groupName);
      }
    }
  }

  private convImportPath(dir: string): string {
    dir = path.normalize(dir);
    return path.join('forcedata', dir);
  }

  private printFragmentsGroupBySubType(
    subTypeName: string,
    dataIds: string[],
    fragments: FactoryRegistrationFragment[],
    outputDir: string,
    groupName: string
  ) {
    const fn = util.snakeCase(subTypeName);
    const modelDir = path.join(outputDir, 'model');
    const dataDir = path.join(outputDir, 'data', groupName);
    const filePath = path.join(dataDir, `${fn}.go`);
    const data = {
      subTypeName: subTypeName,
      dataIds: dataIds,
      fragments: fragments,
      packageName: groupName,
      importPath: this.convImportPath(modelDir),
    };
    const template = `
// +build test

package <%= packageName %>

import (
	"<%= importPath %>"
)

// データの識別子
const (
  <%_ dataIds.forEach((dataId) => { _%>
    <%= dataId %> model.DataID = "<%= dataId %>"
  <%_ }); _%>
)

func Register<%= subTypeName %>() {
  f := model.Factory
  <%_ fragments.forEach((fragment) => { _%>
    f.Register(<%= fragment.objectId.dataId %>, func() interface{} {
      <%- fragment.text _%>
    })
  <%_ }); _%>
}
`;
    const text = ejs.render(template, data, {});
    this.write(filePath, text);
  }

  private printData(pc: ProgramCode, dir: string) {
    const impPaths = [];
    for (const group of pc.registrationGroupFragments) {
      impPaths.push(this.convImportPath(path.join(dir, 'data', group.groupName)));
    }
    impPaths.push(this.convImportPath(path.join(dir, 'model')));
    const data = {
      pc: pc,
      impPaths: impPaths,
    };
    const outputPath = path.join(dir, 'data/data.go');
    const template = `
// +build test

package data

import (
  <%_ impPaths.forEach((impPath) => { _%>
    "<%= impPath %>"
  <%_ }); _%>
)

// データ登録
func RegisterData() {
  <%_ pc.registrationGroupFragments.forEach((group) => { _%>
    <%_ group.subTypeNames.forEach((subTypeName) => { _%>
      <%= group.groupName %>.Register<%= subTypeName %>()
    <%_ }); _%>
  <%_ }); _%>
}

var TestData = map[string]model.DataID {
  <%_ pc.testDataFragment.forEach((testData) => { _%>
    "<%= testData.fileName %>": <%= testData.segmentName %>.<%= testData.rootDataId %>,
  <%_ }); _%>
}
`;
    const text = ejs.render(template, data, {});
    this.write(outputPath, text);
  }

  private printModel(pc: ProgramCode, outputPath: string) {
    const data = {
      pc: pc,
    };
    const template = `
// +build test

package model

type StringOrNull interface{}
type Int64OrNull interface{}
type BoolOrNull interface{}

<%_ pc.subTypeDefinitionFragments.forEach((sunTypeDefn) => { %>
type <%= sunTypeDefn.subTypeName %> struct {
  <%_ sunTypeDefn.fields.forEach((fieldDefn) => { _%>
    <%= fieldDefn.fieldName %> <%= fieldDefn.typeName %> \`json:"<%- fieldDefn.jsonName %>"\`
  <%_ }); _%>
}
<% }); %>
`;
    const text = ejs.render(template, data, {});
    this.write(outputPath, text);
  }

  private write(outputPath: string, text: string) {
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, text);
    execSync(`gofmt -w ${outputPath}`);
  }
}

function primitiveToStr(val: unknown): string {
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

export class GolangFactoryRegistrationFragment extends FactoryRegistrationFragment {
  constructor(s: FactoryRegistrationFragment, readonly text: string) {
    super(s.objectId, s.subType, s.dataItems);
  }
}

export class GolangSubTypeFieldFragment extends SubTypeFieldFragment {
  constructor(
    readonly fieldName: string,
    readonly typeName: string,
    readonly typeNameSingle: string,
    readonly jsonName: string,
    readonly modelTypeName: string,
    readonly modelTypeNameSingle: string
  ) {
    super(fieldName, typeName, typeNameSingle, jsonName);
  }
}

export class GolangCodeConverter extends AbstractProgramCodeConverter {
  convertObjectItemId(dataName: string, subType: SubType): ObjectItemId {
    const objItemId = super.convertObjectItemId(dataName, subType);
    objItemId.typeName = `${subType.typeName.name}`;
    return objItemId;
  }

  convertSubTypeFieldFragment(field: SubTypeField): SubTypeFieldFragment {
    let typeName: string;
    let modelTypeName: string;
    switch (field.systemType) {
      case SystemType.Bool:
        typeName = 'BoolOrNull';
        modelTypeName = `model.${typeName}`;
        break;
      case SystemType.Int64:
        typeName = 'Int64OrNull';
        modelTypeName = `model.${typeName}`;
        break;
      case SystemType.String:
        typeName = 'StringOrNull';
        modelTypeName = `model.${typeName}`;
        break;
      case SystemType.Unknown:
        typeName = 'interface{}';
        modelTypeName = `model.${typeName}`;
        break;
      case SystemType.Object:
        if (!field.objectName) {
          throw new InvalidArgumentError('"SystemType.Object" where objectName is required');
        }
        typeName = `*${field.objectName}`;
        modelTypeName = `*model.${field.objectName}`;
        break;
      default:
        throw new InvalidArgumentError(`unknown systemType: ${field.systemType}`);
    }
    const typeNameSingle = typeName;
    const modelTypeNameSingle = modelTypeName;
    if (field.isArray) {
      typeName = `[]${typeName}`;
      modelTypeName = `[]${modelTypeName}`;
    }
    return new GolangSubTypeFieldFragment(
      util.pascalCase(field.fieldName),
      typeName,
      typeNameSingle,
      field.fieldName,
      modelTypeName,
      modelTypeNameSingle
    );
  }

  convertFactoryRegistration(dataSubType: DataSubType): FactoryRegistrationFragment {
    const s = super.convertFactoryRegistration(dataSubType);
    const renderText = this.renderFactoryRegistrationFragment(s);
    return new GolangFactoryRegistrationFragment(s, renderText);
  }

  private renderFactoryRegistrationFragment(fr: FactoryRegistrationFragment): string {
    if (fr instanceof FactoryRegistrationInheritFragment) {
      return this.renderInheritRegisterString(fr);
    } else {
      return this.renderNewRegisterString(fr);
    }
  }

  private renderNewRegisterString(fr: FactoryRegistrationFragment): string {
    fr.subType;
    let str = `return &model.${fr.objectId.typeName}{\n`;
    for (const objItem of fr.dataItems) {
      if (objItem instanceof ObjectItemFragment) {
        const o = objItem;
        const field = o.field as GolangSubTypeFieldFragment;
        if (!o.dataItem) {
          str += `${field.fieldName}: nil,\n`;
        } else {
          str += `${field.fieldName}: f.ChildNode(${o.dataItem.dataId}).(${field.modelTypeName}),\n`;
        }
      } else if (objItem instanceof ObjectArrayFragment) {
        throw new InvalidArgumentError(
          `renderFactoryRegistrationFragment ので配列型は、新規にインスタンス化されるタイプなので、配列番号が個別に指定される ObjectArrayFragment はありえない ${objItem.field.fieldName} ${objItem.arrayIndex}`
        );
      } else if (objItem instanceof ObjectArrayFullFragment) {
        const o = objItem;
        const field = o.field as GolangSubTypeFieldFragment;
        if (!o.dataItems) {
          str += `${o.field.fieldName}: nil\n`;
        } else {
          str += `${o.field.fieldName}: ${field.modelTypeName}{\n`;
          for (const item of o.dataItems) {
            if (!item) {
              str += 'nil,\n';
            } else {
              str += `f.ChildNode(${item.dataId}).(${field.modelTypeNameSingle}),\n`;
            }
          }
          str += '},\n';
        }
      } else if (objItem instanceof PrimitiveItemFragment) {
        const o = objItem;
        const pstr = primitiveToStr(o.value);
        str += `${o.field.fieldName}: ${pstr},\n`;
      } else if (objItem instanceof PrimitiveArrayFragment) {
        throw new InvalidArgumentError(
          `renderFactoryRegistrationFragment ので配列型は、新規にインスタンス化されるタイプなので、配列番号が個別に指定される ObjectArrayFragment はありえない ${objItem.field.fieldName} ${objItem.arrayIndex}`
        );
      } else if (objItem instanceof PrimitiveArrayFullFragment) {
        const o = objItem;
        const field = o.field as GolangSubTypeFieldFragment;
        str += `${o.field.fieldName}: ${field.modelTypeName}{\n`;
        for (const value of o.values) {
          const pstr = primitiveToStr(value);
          str += `${pstr},\n`;
        }
        str += '},\n';
      } else if (objItem instanceof UnknownItemFragment) {
        str += `${objItem.field.fieldName}: nil,\n`;
      } else if (objItem instanceof UnknownArrayFragment) {
        str += `${objItem.field.fieldName}: ${objItem.field.typeName}{},\n`;
      } else {
        throw new InvalidArgumentError(`objItem が不明: ${objItem.field.fieldName}`);
      }
    }
    str += '}\n';
    return str;
  }

  private renderInheritRegisterString(fr: FactoryRegistrationInheritFragment): string {
    let str = `data := f.InheritNode(${fr.inheritObjectId.dataId}).(*model.${fr.objectId.typeName})\n`;
    for (const objItem of fr.dataItems) {
      if (objItem instanceof ObjectItemFragment) {
        const o = objItem;
        const field = o.field as GolangSubTypeFieldFragment;
        if (!o.dataItem) {
          str += `data.${o.field.fieldName} = nil\n`;
        } else {
          str += `data.${o.field.fieldName} = f.ChildNode(${o.dataItem.dataId}).(${field.modelTypeNameSingle})\n`;
        }
      } else if (objItem instanceof ObjectArrayFragment) {
        const o = objItem;
        const field = o.field as GolangSubTypeFieldFragment;
        if (!o.dataItem) {
          str += `data.${o.field.fieldName}[${o.arrayIndex}] = nil\n`;
        } else {
          str += `data.${o.field.fieldName}[${o.arrayIndex}] = f.ChildNode(${o.dataItem.dataId}).(${field.modelTypeNameSingle})\n`;
        }
      } else if (objItem instanceof ObjectArrayFullFragment) {
        const o = objItem;
        const field = o.field as GolangSubTypeFieldFragment;
        if (!o.dataItems) {
          str += `data.${o.field.fieldName} = nil\n`;
        } else {
          str += `data.${o.field.fieldName} = ${field.modelTypeName}{\n`;
          for (const item of o.dataItems) {
            if (!item) {
              str += 'nil,\n';
            } else {
              str += `f.ChildNode(${item.dataId}).(${field.modelTypeNameSingle}),\n`;
            }
          }
          str += '}\n';
        }
      } else if (objItem instanceof PrimitiveItemFragment) {
        const o = objItem;
        const p = primitiveToStr(o.value);
        str += `data.${o.field.fieldName} = ${p}\n`;
      } else if (objItem instanceof PrimitiveArrayFragment) {
        const o = objItem;
        const p = primitiveToStr(o.value);
        str += `data.${o.field.fieldName}[${o.arrayIndex}] = ${p}\n`;
      } else if (objItem instanceof PrimitiveArrayFullFragment) {
        const o = objItem;
        const field = o.field as GolangSubTypeFieldFragment;
        str += `data.${o.field.fieldName} = ${field.modelTypeName}{\n`;
        for (const value of o.values) {
          const p = primitiveToStr(value);
          str += `${p},\n`;
        }
        str += '}\n';
      } else if (objItem instanceof UnknownItemFragment) {
        str += `data.${objItem.field.fieldName} = nil\n`;
      } else if (objItem instanceof UnknownArrayFragment) {
        str += `data.${objItem.field.fieldName} = ${objItem.field.typeName}{}\n`;
      } else {
        throw new InvalidArgumentError(`objItem が不明: ${objItem.field.fieldName}`);
      }
    }
    str += '  return data\n';
    return str;
  }
}
