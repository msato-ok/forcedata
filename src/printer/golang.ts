import fs from 'fs';
import ejs from 'ejs';
import { execSync } from 'child_process';
import { SubTypeBase, SubTypeField, SystemType } from '../spec/sub_type';
import { InvalidArgumentError } from '../common/base';
import { JsonParseResult } from '../parser/parser';
import * as util from '../common/util';

class GolangSubTypeField extends SubTypeField {
  constructor(private _org: SubTypeField) {
    super(util.pascalCase(_org.fieldName), _org.systemType, _org.objectName, _org.isArray);
  }

  get typeName(): string {
    let t: string;
    switch (this.systemType) {
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
        if (!this.objectName) {
          throw new InvalidArgumentError('"SystemType.Object" where objectName is required');
        }
        t = this.objectName;
        break;
      default:
        throw new InvalidArgumentError(`unknown systemType: ${this.systemType}`);
    }
    if (this.isArray) {
      if (this.systemType == SystemType.Object) {
        t = `[]*${t}`;
      } else {
        t = `[]${t}`;
      }
    }
    return t;
  }

  get jsonTag(): string {
    return '`' + `json:"${this._org.fieldName}"` + '`';
  }
}

class GolangSubType extends SubTypeBase {
  private _goFields: GolangSubTypeField[] = [];

  constructor(private _org: SubTypeBase) {
    super(util.pascalCase(_org.typeName));
    for (const field of _org.fields) {
      const goField = new GolangSubTypeField(field);
      this._goFields.push(goField);
    }
  }

  get fields(): GolangSubTypeField[] {
    return this._goFields;
  }
}

export class GolangPrinter {
  print(parseResult: JsonParseResult, output: string) {
    const goSubTypes = [];
    for (const subType of parseResult.subTypes) {
      goSubTypes.push(new GolangSubType(subType));
    }
    const template = `
/*
json 内で使用されているデータを golang の型にする
*/
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
`;
    const text = ejs.render(
      template,
      {
        goSubTypes: goSubTypes,
      },
      {}
    );
    fs.writeFileSync(output, text);
    execSync(`gofmt -w ${output}`);
  }
}
