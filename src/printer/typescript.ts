import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubTypeName, SubTypeField, SystemType } from '../spec/sub_type';
import { DataFile } from '../spec/data_file';
import { DataSubType } from '../spec/data_file';
import { InvalidArgumentError } from '../common/base';
import { JsonParseResult } from '../parser/parser';
import { Printer } from './base';
import {
  ObjectItemId,
  ProgramCodeConverter,
  SubTypeFieldFragment,
  FactoryRegistrationFlagment,
  FactoryRegistrationInheritFlagment,
  ObjectItemFragment,
  ObjectArrayFragment,
  ObjectArrayFullFragment,
  PrimitiveItemFragment,
  PrimitiveArrayFragment,
  PrimitiveArrayFullFragment,
  UnknownItemFragment,
  UnknownArrayFragment,
  TestDataFragment,
  AbstractProgramCodeConverter,
} from './converter';
import * as util from '../common/util';

export class TsPrinter implements Printer {
  private _converter: ProgramCodeConverter;

  constructor(private packageName: string, readonly converter: ProgramCodeConverter | null = null) {
    if (converter) {
      this._converter = converter;
    } else {
      this._converter = new TsCodeConverter();
    }
  }

  print(parseResult: JsonParseResult, outputPath: string) {
    const pc = this._converter.convert(parseResult);
    const data = {
      pc: pc,
    };
    const template = `
import { factory } from './factory';

<%_ pc.subTypeDefinitionFragments.forEach((sunTypeDefn) => { %>
  <%_ if (sunTypeDefn.fields.length == 0) { _%>
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
  <%_ } _%>
  export interface <%= sunTypeDefn.subTypeName %> {
    <%_ sunTypeDefn.fields.forEach((field) => { _%>
      <%= field.fieldName %>: <%= field.typeName %>
    <%_ }); _%>
  }
<% }); %>

// データの識別子
export const DATAID = {
  <%_ pc.dataIdConstantFragments.forEach((dataId) => { _%>
    <%= dataId %>: '<%= dataId %>',
  <%_ }); _%>
} as const;
export type DATAID = typeof DATAID[keyof typeof DATAID];

// データ登録
export function registerData() {
  <%_ pc.registrationGroupFragments.forEach((group) => { _%>
    registerGroup<%= group.groupNo %>();
  <%_ }); _%>
}

<%_ pc.registrationGroupFragments.forEach((group) => { _%>
  export function registerGroup<%= group.groupNo %>() {
    const f = factory;
    <%_ group.factoryRegistrationFlagments.forEach((fRegister) => { _%>
      f.register(DATAID.<%= fRegister.objectId.dataId %>, () => {
        <%- fRegister.text _%>
      });
    <%_ }); _%>
  }
<%_ }); _%>

export const TestData = {
  <%_ pc.testDataFragment.forEach((testData) => { _%>
    "<%= testData.fileName %>": DATAID.<%= testData.rootDataId %>,
  <%_ }); _%>
};
`;
    const text = ejs.render(template, data, {});
    fs.writeFileSync(outputPath, text);
    execSync(`eslint ${outputPath} --fix`);
  }
}

function primitiveToStr(val: unknown): string {
  if (val == null) {
    return 'null';
  }
  if (util.isString(val)) {
    return JSON.stringify(val);
  }
  return `${val}`;
}

export class TsRegistrationFlagment extends FactoryRegistrationFlagment {
  constructor(s: FactoryRegistrationFlagment, readonly text: string) {
    super(s.objectId, s.subType, s.dataItems);
  }
}

export class TsCodeConverter extends AbstractProgramCodeConverter {
  convertSubTypeFieldFragment(field: SubTypeField): SubTypeFieldFragment {
    let typeName: string;
    switch (field.systemType) {
      case SystemType.Bool:
        typeName = 'boolean';
        break;
      case SystemType.Int64:
        typeName = 'number';
        break;
      case SystemType.String:
        typeName = 'string';
        break;
      case SystemType.Unknown:
        typeName = 'unknown';
        break;
      case SystemType.Object:
        if (!field.objectName) {
          throw new InvalidArgumentError('"SystemType.Object" where objectName is required');
        }
        typeName = field.objectName;
        break;
      default:
        throw new InvalidArgumentError(`unknown systemType: ${field.systemType}`);
    }
    const typeNameSingle = typeName;
    if (field.isArray) {
      typeName = `${typeName}[]`;
    }
    return new SubTypeFieldFragment(field.fieldName, typeName, typeNameSingle, field.fieldName);
  }

  convertObjectItemId(dataName: string, subTypeName: SubTypeName): ObjectItemId {
    const dataId = util.snakeCase(dataName).toUpperCase();
    return super.convertObjectItemId(dataId, subTypeName);
  }

  convertFactoryRegistration(dataSubType: DataSubType): FactoryRegistrationFlagment {
    const s = super.convertFactoryRegistration(dataSubType);
    const renderText = this.renderFactoryRegistrationFlagment(s);
    return new TsRegistrationFlagment(s, renderText);
  }

  renderFactoryRegistrationFlagment(fr: FactoryRegistrationFlagment): string {
    if (fr instanceof FactoryRegistrationInheritFlagment) {
      return this.renderInheritRegisterString(fr);
    } else {
      return this.renderNewRegisterString(fr);
    }
  }

  convertTestDataCode(dataFile: DataFile): TestDataFragment {
    return {
      fileName: dataFile.baseFile,
      rootDataId: util.snakeCase(dataFile.rootDataSubType.dataName).toUpperCase(),
    };
  }

  renderNewRegisterString(fr: FactoryRegistrationFlagment): string {
    let str = 'return {\n';
    for (const objItem of fr.dataItems) {
      if (objItem instanceof ObjectItemFragment) {
        const o = objItem;
        if (!o.dataItem) {
          str += `${o.field.fieldName}: null,\n`;
        } else {
          str += `${o.field.fieldName}: f.childNode(DATAID.${o.dataItem.dataId}) as ${o.dataItem.typeName},\n`;
        }
      } else if (objItem instanceof ObjectArrayFragment) {
        throw new InvalidArgumentError(
          `renderFactoryRegistrationFlagment ので配列型は、新規にインスタンス化されるタイプなので、配列番号が個別に指定される ObjectArrayFragment はありえない ${objItem.field.fieldName} ${objItem.arrayIndex}`
        );
      } else if (objItem instanceof ObjectArrayFullFragment) {
        const o = objItem;
        if (!o.dataItems) {
          str += `${o.field.fieldName}: null,\n`;
        } else {
          str += `${o.field.fieldName}: [\n`;
          for (const item of o.dataItems) {
            if (!item) {
              str += 'null,\n';
            } else {
              str += `f.childNode(DATAID.${item.dataId}) as ${item.typeName},\n`;
            }
          }
          str += '],\n';
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
        str += `${o.field.fieldName}: [\n`;
        for (const value of o.values) {
          const pstr = primitiveToStr(value);
          str += `${pstr},\n`;
        }
        str += '],\n';
      } else if (objItem instanceof UnknownItemFragment) {
        str += `${objItem.field.fieldName}: null,\n`;
      } else if (objItem instanceof UnknownArrayFragment) {
        str += `${objItem.field.fieldName}: [] as ${objItem.field.typeName},\n`;
      } else {
        throw new InvalidArgumentError(`objItem が不明: ${objItem.field.fieldName}`);
      }
    }
    str += `} as ${fr.objectId.typeName}\n`;
    return str;
  }

  renderInheritRegisterString(fr: FactoryRegistrationInheritFlagment): string {
    let str = `const data = f.inheritNode(DATAID.${fr.inheritObjectId.dataId}) as ${fr.objectId.typeName};\n`;
    for (const objItem of fr.dataItems) {
      if (objItem instanceof ObjectItemFragment) {
        const o = objItem;
        if (!o.dataItem) {
          str += `data.${o.field.fieldName} = null;\n`;
        } else {
          str += `data.${o.field.fieldName} = f.childNode(DATAID.${o.dataItem.dataId}) as ${o.dataItem.typeName};\n`;
        }
      } else if (objItem instanceof ObjectArrayFragment) {
        const o = objItem;
        if (!o.dataItem) {
          str += `data.${o.field.fieldName}[${o.arrayIndex}] = null;\n`;
        } else {
          str += `data.${o.field.fieldName}[${o.arrayIndex}] = f.childNode(DATAID.${o.dataItem.dataId}) as ${o.dataItem.typeName};\n`;
        }
      } else if (objItem instanceof ObjectArrayFullFragment) {
        const o = objItem;
        if (!o.dataItems) {
          str += `data.${o.field.fieldName} = null;\n`;
        } else {
          str += `data.${o.field.fieldName} = [\n`;
          for (const item of o.dataItems) {
            if (!item) {
              str += 'null,\n';
            } else {
              str += `f.childNode(DATAID.${item.dataId}) as ${o.field.typeNameSingle},\n`;
            }
          }
          str += '];\n';
        }
      } else if (objItem instanceof PrimitiveItemFragment) {
        const o = objItem;
        const p = primitiveToStr(o.value);
        str += `data.${o.field.fieldName} = ${p};\n`;
      } else if (objItem instanceof PrimitiveArrayFragment) {
        const o = objItem;
        const p = primitiveToStr(o.value);
        str += `data.${o.field.fieldName}[${o.arrayIndex}] = ${p};\n`;
      } else if (objItem instanceof PrimitiveArrayFullFragment) {
        const o = objItem;
        str += `data.${o.field.fieldName} = [\n`;
        for (const value of o.values) {
          const p = primitiveToStr(value);
          str += `${p},\n`;
        }
        str += '];\n';
      } else if (objItem instanceof UnknownItemFragment) {
        str += `data.${objItem.field.fieldName} = null;\n`;
      } else if (objItem instanceof UnknownArrayFragment) {
        str += `data.${objItem.field.fieldName} = [];\n`;
      } else {
        throw new InvalidArgumentError(`objItem が不明: ${objItem.field.fieldName}`);
      }
    }
    str += '  return data\n';
    return str;
  }
}
