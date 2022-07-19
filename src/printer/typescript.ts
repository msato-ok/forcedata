import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubTypeField, SystemType } from '../spec/sub_type';
import { DataSubType } from '../spec/data_file';
import { InvalidArgumentError } from '../common/base';
import { Segment } from '../parser/segmenter';
import { Printer } from './base';
import {
  ProgramCode,
  ProgramCodeConverter,
  SubTypeFieldFragment,
  FactoryRegistrationFragment,
  FactoryRegistrationInheritFragment,
  ObjectItemFragment,
  ObjectArrayFragment,
  ObjectArrayFullFragment,
  PrimitiveItemFragment,
  PrimitiveArrayFragment,
  PrimitiveArrayFullFragment,
  UnknownItemFragment,
  UnknownArrayFragment,
  AbstractProgramCodeConverter,
} from './converter';
import * as util from '../common/util';
import path from 'path';

export class TsPrinter implements Printer {
  private _converter: ProgramCodeConverter;

  constructor(readonly converter: ProgramCodeConverter | null = null) {
    if (converter) {
      this._converter = converter;
    } else {
      this._converter = new TsCodeConverter();
    }
  }

  print(segments: Segment[], outputDir: string) {
    const pc = this._converter.convert(segments);
    this.printFactory(outputDir);
    this.printModel(pc, outputDir);
    this.printDataId(pc, outputDir);
    for (const rgf of pc.registrationGroupFragments) {
      for (const subTypeName of rgf.subTypeNames) {
        const fragments = rgf.getFragmentsGroupBySubType(subTypeName);
        this.printFragmentsGroupBySubType(subTypeName, fragments, outputDir, rgf.groupName);
      }
    }
    this.printData(pc, outputDir);
  }

  private printFragmentsGroupBySubType(
    subTypeName: string,
    fragments: FactoryRegistrationFragment[],
    outputDir: string,
    groupName: string
  ) {
    const fn = util.snakeCase(subTypeName);
    const groupPath = util.snakeCase(groupName);
    const dataDir = path.join(outputDir, 'data', groupPath);
    const outputPath = path.join(dataDir, `${fn}.ts`);
    const impSubTypes = new Set<string>();
    impSubTypes.add(subTypeName);
    for (const fragment of fragments) {
      for (const f of fragment.subType.fields) {
        const tsField = f as TsSubTypeFieldFragment;
        if (tsField.isObject) {
          impSubTypes.add(f.typeNameSingle);
        }
      }
    }
    const data = {
      impSubTypes: Array.from(impSubTypes),
      subTypeName: subTypeName,
      fragments: fragments,
      groupTitle: util.pascalCase(groupName),
    };
    const template = `
import { factory } from '../../model/factory';
import { <%= impSubTypes.join(', ') %> } from '../../model/model';
import { DATAID } from '../dataid';

export function register<%= groupTitle %><%= subTypeName %>() {
  const f = factory;
  <%_ fragments.forEach((fragment) => { _%>
    f.register(DATAID.<%= fragment.objectId.dataId %>, () => {
      <%- fragment.text _%>
    });
  <%_ }); _%>
}
`;
    const text = ejs.render(template, data, {});
    this.write(outputPath, text);
  }

  private printDataId(pc: ProgramCode, dir: string) {
    const data = {
      pc: pc,
    };
    const outputPath = path.join(dir, 'data/dataid.ts');
    const template = `
// データの識別子
export const DATAID = {
  <%_ pc.dataIdConstantFragments.forEach((dataId) => { _%>
    <%= dataId %>: '<%= dataId %>',
  <%_ }); _%>
} as const;
export type DATAID = typeof DATAID[keyof typeof DATAID];
`;
    const text = ejs.render(template, data, {});
    this.write(outputPath, text);
  }

  private printData(pc: ProgramCode, dir: string) {
    const funcList = [];
    for (const group of pc.registrationGroupFragments) {
      const groupName = util.pascalCase(group.groupName);
      const groupNamePath = util.snakeCase(group.groupName);
      for (const subTypeName of group.subTypeNames) {
        const subTypeNamePath = util.snakeCase(subTypeName);
        funcList.push({
          funcName: `register${groupName}${subTypeName}`,
          impPath: `./${groupNamePath}/${subTypeNamePath}`,
        });
      }
    }
    const data = {
      pc: pc,
      funcList: funcList,
    };
    const outputPath = path.join(dir, 'data/data.ts');
    const template = `
<%_ funcList.forEach((func) => { _%>
  import { <%= func.funcName %> } from '<%= func.impPath %>';
<%_ }); _%>
import { DATAID } from './dataid';

// データ登録
export function registerData() {
  <%_ funcList.forEach((func) => { _%>
    <%= func.funcName %>();
  <%_ }); _%>
}

export const TestData = {
  <%_ pc.testDataFragment.forEach((testData) => { _%>
    "<%= testData.fileName %>": DATAID.<%= testData.rootDataId %>,
  <%_ }); _%>
};
`;
    const text = ejs.render(template, data, {});
    this.write(outputPath, text);
  }

  private printModel(pc: ProgramCode, outputDir: string) {
    const data = {
      pc: pc,
    };
    const outputPath = path.join(outputDir, 'model/model.ts');
    const template = `
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
`;
    const text = ejs.render(template, data, {});
    this.write(outputPath, text);
  }

  private printFactory(outputDir: string) {
    const outputPath = path.join(outputDir, 'model/factory.ts');
    const template = `
// -------------------------------------------------------
// データのファクトリー
//
// データを関数で登録して、データの関連をノードツリーにして
// 可視化できるように管理する
//

export type DataId = string;

export class InvalidArgumentError extends Error {}

// --------------------------------------------
//

export class DataNode {
  inheritDataId: DataId | undefined = undefined;
  properties: DataId[] = [];

  constructor(readonly dataId: DataId) {}
}

export type Callback = () => unknown;

// DataFactory データのファクトリー
export interface DataFactory {
  get(dataId: DataId): unknown;
  register(dataId: DataId, dataFn: Callback): void;
  inheritNode(dataId: DataId): unknown;
  childNode(dataId: DataId): unknown;
  nodeList(): DataNode[];
}

class DataFactoryImpl implements DataFactory {
  private cacheFn = new Map<DataId, Callback>();
  private cacheData = new Map<DataId, unknown>();
  private nodes = new Map<DataId, DataNode>();
  private nodeStack: DataNode[] = [];

  private getData(dataId: DataId): unknown {
    const data = this.cacheData.get(dataId);
    if (!data) {
      throw new InvalidArgumentError(\`\${dataId} は未登録\`);
    }
    return data;
  }

  private getDataFn(dataId: DataId): Callback {
    const dataFn = this.cacheFn.get(dataId);
    if (!dataFn) {
      throw new InvalidArgumentError(\`\${dataId} は未登録\`);
    }
    return dataFn;
  }

  private pushNode(node: DataNode) {
    this.nodeStack.push(node);
  }

  private popNode() {
    this.nodeStack.pop();
  }

  private lastNode(): DataNode {
    return this.nodeStack[this.nodeStack.length - 1];
  }

  private execNode(dataId: DataId): unknown {
    const dataFn = this.getDataFn(dataId);
    const node = new DataNode(dataId);
    this.nodes.set(dataId, node);
    this.pushNode(node);
    const data = dataFn();
    this.popNode();
    return data;
  }

  public get(dataId: DataId): unknown {
    return this.getData(dataId);
  }

  public register(dataId: DataId, dataFn: Callback) {
    this.cacheFn.set(dataId, dataFn);
    const data = this.execNode(dataId);
    this.cacheData.set(dataId, data);
  }

  public inheritNode(dataId: DataId): unknown {
    const node = this.lastNode();
    node.inheritDataId = dataId;
    return this.execNode(dataId);
  }

  public childNode(dataId: DataId): unknown {
    const node = this.lastNode();
    let found = false;
    for (const id of node.properties) {
      if (id == dataId) {
        found = true;
        break;
      }
    }
    if (!found) {
      node.properties.push(dataId);
    }
    return this.execNode(dataId);
  }

  public nodeList(): DataNode[] {
    const nodes: DataNode[] = [];
    for (const node of Array.from(this.nodes.values())) {
      nodes.push(node);
    }
    return nodes;
  }
}

export const factory = new DataFactoryImpl();
`;
    const text = ejs.render(template, {}, {});
    this.write(outputPath, text);
  }

  private write(outputPath: string, text: string) {
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
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

export class TsRegistrationFragment extends FactoryRegistrationFragment {
  constructor(s: FactoryRegistrationFragment, readonly text: string) {
    super(s.objectId, s.subType, s.dataItems);
  }
}

export class TsSubTypeFieldFragment extends SubTypeFieldFragment {
  constructor(
    readonly fieldName: string,
    readonly typeName: string,
    readonly typeNameSingle: string,
    readonly jsonName: string,
    readonly isObject: boolean
  ) {
    super(fieldName, typeName, typeNameSingle, jsonName);
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
    const isObject = field.systemType == SystemType.Object;
    return new TsSubTypeFieldFragment(field.fieldName, typeName, typeNameSingle, field.fieldName, isObject);
  }

  convertDataId(dataName: string): string {
    return util.snakeCase(dataName).toUpperCase();
  }

  convertFactoryRegistration(dataSubType: DataSubType): FactoryRegistrationFragment {
    const s = super.convertFactoryRegistration(dataSubType);
    const renderText = this.renderFactoryRegistrationFragment(s);
    return new TsRegistrationFragment(s, renderText);
  }

  private renderFactoryRegistrationFragment(fr: FactoryRegistrationFragment): string {
    if (fr instanceof FactoryRegistrationInheritFragment) {
      return this.renderInheritRegisterString(fr);
    } else {
      return this.renderNewRegisterString(fr);
    }
  }

  private renderNewRegisterString(fr: FactoryRegistrationFragment): string {
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
          `renderFactoryRegistrationFragment ので配列型は、新規にインスタンス化されるタイプなので、配列番号が個別に指定される ObjectArrayFragment はありえない ${objItem.field.fieldName} ${objItem.arrayIndex}`
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
          `renderFactoryRegistrationFragment ので配列型は、新規にインスタンス化されるタイプなので、配列番号が個別に指定される ObjectArrayFragment はありえない ${objItem.field.fieldName} ${objItem.arrayIndex}`
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

  private renderInheritRegisterString(fr: FactoryRegistrationInheritFragment): string {
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
