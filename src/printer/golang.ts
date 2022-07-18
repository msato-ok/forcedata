import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubTypeField, SystemType } from '../spec/sub_type';
import { DataSubType } from '../spec/data_file';
import { InvalidArgumentError } from '../common/base';
import { Segment } from '../parser/segmenter';
import { Printer } from './base';
import {
  ProgramCodeConverter,
  SubTypeFieldFragment,
  FactoryRegistrationFlagment,
  ObjectItemFragment,
  ObjectArrayFragment,
  ObjectArrayFullFragment,
  PrimitiveItemFragment,
  PrimitiveArrayFragment,
  PrimitiveArrayFullFragment,
  UnknownItemFragment,
  UnknownArrayFragment,
  AbstractProgramCodeConverter,
  FactoryRegistrationInheritFlagment,
} from './converter';
import * as util from '../common/util';

export class GolangPrinter implements Printer {
  private _converter: ProgramCodeConverter;

  constructor(private packageName: string, readonly converter: ProgramCodeConverter | null = null) {
    if (converter) {
      this._converter = converter;
    } else {
      this._converter = new GolangCodeConverter();
    }
  }

  print(segments: Segment[], outputPath: string) {
    const pc = this._converter.convert(segments);
    const data = {
      pc: pc,
      packageName: this.packageName,
    };
    const template = `
// +build test

package <%= packageName %>

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

// データの識別子
const (
  <%_ pc.dataIdConstantFragments.forEach((dataId) => { _%>
    <%= dataId %> DataID = "<%= dataId %>"
  <%_ }); _%>
)

// データ登録
func RegisterData() {
  <%_ pc.registrationGroupFragments.forEach((group) => { _%>
    RegisterGroup<%= group.groupNo %>()
  <%_ }); _%>
}

<%_ pc.registrationGroupFragments.forEach((group) => { _%>
  func RegisterGroup<%= group.groupNo %>() {
    f := Factory
    <%_ group.factoryRegistrationFlagments.forEach((fRegister) => { _%>
      f.Register(<%= fRegister.objectId.dataId %>, func() interface{} {
        <%- fRegister.text _%>
      })
    <%_ }); _%>
  }
<%_ }); _%>

var TestData = map[string]DataID {
  <%_ pc.testDataFragment.forEach((testData) => { _%>
    "<%= testData.fileName %>": <%= testData.rootDataId %>,
  <%_ }); _%>
}
`;
    const text = ejs.render(template, data, {});
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

export class GolangFactoryRegistrationFlagment extends FactoryRegistrationFlagment {
  constructor(s: FactoryRegistrationFlagment, readonly text: string) {
    super(s.objectId, s.subType, s.dataItems);
  }
}

export class GolangCodeConverter extends AbstractProgramCodeConverter {
  convertSubTypeFieldFragment(field: SubTypeField): SubTypeFieldFragment {
    let typeName: string;
    switch (field.systemType) {
      case SystemType.Bool:
        typeName = 'BoolOrNull';
        break;
      case SystemType.Int64:
        typeName = 'Int64OrNull';
        break;
      case SystemType.String:
        typeName = 'StringOrNull';
        break;
      case SystemType.Unknown:
        typeName = 'interface{}';
        break;
      case SystemType.Object:
        if (!field.objectName) {
          throw new InvalidArgumentError('"SystemType.Object" where objectName is required');
        }
        typeName = `*${field.objectName}`;
        break;
      default:
        throw new InvalidArgumentError(`unknown systemType: ${field.systemType}`);
    }
    const typeNameSingle = typeName;
    if (field.isArray) {
      typeName = `[]${typeName}`;
    }
    return new SubTypeFieldFragment(util.pascalCase(field.fieldName), typeName, typeNameSingle, field.fieldName);
  }

  convertFactoryRegistration(dataSubType: DataSubType): FactoryRegistrationFlagment {
    const s = super.convertFactoryRegistration(dataSubType);
    const renderText = this.renderFactoryRegistrationFlagment(s);
    return new GolangFactoryRegistrationFlagment(s, renderText);
  }

  private renderFactoryRegistrationFlagment(fr: FactoryRegistrationFlagment): string {
    if (fr instanceof FactoryRegistrationInheritFlagment) {
      return this.renderInheritRegisterString(fr);
    } else {
      return this.renderNewRegisterString(fr);
    }
  }

  private renderNewRegisterString(fr: FactoryRegistrationFlagment): string {
    let str = `return &${fr.objectId.typeName}{\n`;
    for (const objItem of fr.dataItems) {
      if (objItem instanceof ObjectItemFragment) {
        const o = objItem;
        if (!o.dataItem) {
          str += `${o.field.fieldName}: nil,\n`;
        } else {
          str += `${o.field.fieldName}: f.ChildNode(${o.dataItem.dataId}).(*${o.dataItem.typeName}),\n`;
        }
      } else if (objItem instanceof ObjectArrayFragment) {
        throw new InvalidArgumentError(
          `renderFactoryRegistrationFlagment ので配列型は、新規にインスタンス化されるタイプなので、配列番号が個別に指定される ObjectArrayFragment はありえない ${objItem.field.fieldName} ${objItem.arrayIndex}`
        );
      } else if (objItem instanceof ObjectArrayFullFragment) {
        const o = objItem;
        if (!o.dataItems) {
          str += `${o.field.fieldName}: nil\n`;
        } else {
          str += `${o.field.fieldName}: ${o.field.typeName}{\n`;
          for (const item of o.dataItems) {
            if (!item) {
              str += 'nil,\n';
            } else {
              str += `f.ChildNode(${item.dataId}).(*${item.typeName}),\n`;
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
          `renderFactoryRegistrationFlagment ので配列型は、新規にインスタンス化されるタイプなので、配列番号が個別に指定される ObjectArrayFragment はありえない ${objItem.field.fieldName} ${objItem.arrayIndex}`
        );
      } else if (objItem instanceof PrimitiveArrayFullFragment) {
        const o = objItem;
        str += `${o.field.fieldName}: ${o.field.typeName}{\n`;
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

  private renderInheritRegisterString(fr: FactoryRegistrationInheritFlagment): string {
    let str = `data := f.InheritNode(${fr.inheritObjectId.dataId}).(*${fr.objectId.typeName})\n`;
    for (const objItem of fr.dataItems) {
      if (objItem instanceof ObjectItemFragment) {
        const o = objItem;
        if (!o.dataItem) {
          str += `data.${o.field.fieldName} = nil\n`;
        } else {
          str += `data.${o.field.fieldName} = f.ChildNode(${o.dataItem.dataId}).(*${o.dataItem.typeName})\n`;
        }
      } else if (objItem instanceof ObjectArrayFragment) {
        const o = objItem;
        if (!o.dataItem) {
          str += `data.${o.field.fieldName}[${o.arrayIndex}] = nil\n`;
        } else {
          str += `data.${o.field.fieldName}[${o.arrayIndex}] = f.ChildNode(${o.dataItem.dataId}).(*${o.dataItem.typeName})\n`;
        }
      } else if (objItem instanceof ObjectArrayFullFragment) {
        const o = objItem;
        if (!o.dataItems) {
          str += `data.${o.field.fieldName} = nil\n`;
        } else {
          str += `data.${o.field.fieldName} = ${o.field.typeName}{\n`;
          for (const item of o.dataItems) {
            if (!item) {
              str += 'nil,\n';
            } else {
              str += `f.ChildNode(${item.dataId}).(*${item.typeName}),\n`;
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
        str += `data.${o.field.fieldName} = ${o.field.typeName}{\n`;
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
