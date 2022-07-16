import { SubType, SubTypeName, SubTypeField, SystemType } from '../spec/sub_type';
import { DataSubType, DataFile, DiffValue, DiffArrayAllValues, DiffArrayValue } from '../spec/data_file';
import { InvalidArgumentError } from '../common/base';
import { JsonParseResult } from '../parser/parser';
import * as util from '../common/util';

/*
 * DataSubType や SubType からプログラムのコード片の XxxxFragment に変換する。
 *
 * 各種言語コードのレンダリング処理部に重複したロジックを書かないように、
 * ProgramCodeConverter に変換処理を実装する。
 *
 * ProgramCodeConverter によって、作成される XxxxFragment は、できるだけ、
 * ロジックを書かないように DTO に徹する。
 */

/**
 * データのクラス名(インターフェース名)と、フィールドのリスト
 */
export class SubTypeFragment {
  constructor(readonly subTypeName: string, readonly fields: SubTypeFieldFragment[]) {}
}

/**
 * データのフィールド
 */
export class SubTypeFieldFragment {
  constructor(
    readonly fieldName: string,
    readonly typeName: string,
    readonly typeNameSingle: string,
    readonly jsonName: string
  ) {}
}

export class DataItemFragment {
  constructor(readonly field: SubTypeFieldFragment) {}
}

export interface ObjectItemId {
  dataId: string;
  typeName: string;
}

export class ObjectItemFragment extends DataItemFragment {
  constructor(readonly field: SubTypeFieldFragment, readonly dataItem: ObjectItemId | null) {
    super(field);
  }
}

export class ObjectArrayFragment extends DataItemFragment {
  constructor(
    readonly field: SubTypeFieldFragment,
    readonly arrayIndex: number,
    readonly dataItem: ObjectItemId | null
  ) {
    super(field);
  }
}

export class ObjectArrayFullFragment extends DataItemFragment {
  constructor(readonly field: SubTypeFieldFragment, readonly dataItems: (ObjectItemId | null)[] | null) {
    super(field);
  }
}

export class PrimitiveItemFragment extends DataItemFragment {
  constructor(readonly field: SubTypeFieldFragment, readonly value: string | number | boolean) {
    super(field);
  }
}

export class PrimitiveArrayFragment extends DataItemFragment {
  constructor(
    readonly field: SubTypeFieldFragment,
    readonly arrayIndex: number,
    readonly value: string | number | boolean
  ) {
    super(field);
  }
}

export class PrimitiveArrayFullFragment extends DataItemFragment {
  constructor(readonly field: SubTypeFieldFragment, readonly values: (string | number | boolean)[]) {
    super(field);
  }
}

export class UnknownItemFragment extends DataItemFragment {
  constructor(readonly field: SubTypeFieldFragment) {
    super(field);
  }
}

export class UnknownArrayFragment extends DataItemFragment {
  constructor(readonly field: SubTypeFieldFragment) {
    super(field);
  }
}

export class FactoryRegistrationFlagment {
  constructor(
    readonly objectId: ObjectItemId,
    readonly subType: SubTypeFragment,
    readonly dataItems: DataItemFragment[]
  ) {}
}

export class FactoryRegistrationInheritFlagment extends FactoryRegistrationFlagment {
  constructor(
    readonly objectId: ObjectItemId,
    readonly inheritObjectId: ObjectItemId,
    readonly subType: SubTypeFragment,
    readonly dataItems: DataItemFragment[]
  ) {
    super(objectId, subType, dataItems);
  }
}

export class RegistrationGroupFragment {
  constructor(readonly groupNo: number, readonly factoryRegistrationFlagments: FactoryRegistrationFlagment[]) {}
}

/**
 * json ファイル名とファイルのルートオブジェクトのデータIDの組み合わせ
 */
export class TestDataFragment {
  constructor(readonly fileName: string, readonly rootDataId: string) {}
}

export class ProgramCode {
  constructor(
    readonly subTypeDefinitionFragments: SubTypeFragment[],
    readonly dataIdConstantFragments: string[],
    readonly registrationGroupFragments: RegistrationGroupFragment[],
    readonly testDataFragment: TestDataFragment[]
  ) {}
}

export interface ProgramCodeConverter {
  convert(parseResult: JsonParseResult): ProgramCode;
}

export abstract class AbstractProgramCodeConverter implements ProgramCodeConverter {
  private uniqObjectDataId: Map<string, ObjectItemId> = new Map<string, ObjectItemId>();
  private registrationGroupNo = 1;

  abstract convertSubTypeFieldFragment(field: SubTypeField): SubTypeFieldFragment;

  convertSubTypeFragment(subType: SubType): SubTypeFragment {
    const fields = [];
    for (const field of subType.fields) {
      fields.push(this.convertSubTypeFieldFragment(field));
    }
    return new SubTypeFragment(subType.typeName.name, fields);
  }

  convertObjectItemId(dataName: string, subTypeName: SubTypeName): ObjectItemId {
    const objItemId = {
      dataId: dataName,
      typeName: subTypeName.name,
    } as ObjectItemId;
    this.uniqObjectDataId.set(objItemId.dataId, objItemId);
    return objItemId;
  }

  convertDataItemFragment(subTypeField: SubTypeField, dataSubType: DataSubType): DataItemFragment {
    const fieldFr = this.convertSubTypeFieldFragment(subTypeField);
    if (subTypeField.systemType == SystemType.Object) {
      if (subTypeField.isArray) {
        const dsTypes = dataSubType.getArrayDataSubType(subTypeField.fieldName);
        const objItemIds = [];
        for (const dst of dsTypes) {
          const objItemId = this.convertObjectItemId(dst.similarAncesters.dataName, dst.subType.typeName);
          objItemIds.push(objItemId);
        }
        return new ObjectArrayFullFragment(fieldFr, objItemIds);
      } else {
        const dst = dataSubType.getDataSubType(subTypeField.fieldName);
        const objItemId = this.convertObjectItemId(dst.similarAncesters.dataName, dst.subType.typeName);
        return new ObjectItemFragment(fieldFr, objItemId);
      }
    } else if (subTypeField.systemType == SystemType.Unknown) {
      if (subTypeField.isArray) {
        return new UnknownArrayFragment(fieldFr);
      } else {
        return new UnknownItemFragment(fieldFr);
      }
    } else if (subTypeField.isPrimitiveType) {
      if (subTypeField.isArray) {
        return new PrimitiveArrayFullFragment(fieldFr, dataSubType.getArrayValue(subTypeField.fieldName));
      } else {
        return new PrimitiveItemFragment(fieldFr, dataSubType.getValue(subTypeField.fieldName));
      }
    } else {
      throw new InvalidArgumentError(`systemType が不明: systemType=${subTypeField.systemType}`);
    }
  }

  convertInheritDataItemFragment(diffValue: DiffValue, dataSubType: DataSubType): DataItemFragment {
    const field = diffValue.field;
    const pcField = this.convertSubTypeFieldFragment(field);
    if (field.systemType == SystemType.Object) {
      if (field.isArray) {
        if (diffValue instanceof DiffArrayAllValues) {
          const childrenDataSubType = diffValue.value as DataSubType[];
          let objItemIds: (ObjectItemId | null)[] | null = null;
          if (childrenDataSubType != null) {
            objItemIds = [];
            for (const childDst of childrenDataSubType) {
              if (childDst == null) {
                objItemIds.push(null);
              } else {
                const objItemId = this.convertObjectItemId(
                  childDst.similarAncesters.dataName,
                  childDst.subType.typeName
                );
                objItemIds.push(objItemId);
              }
            }
          }
          return new ObjectArrayFullFragment(pcField, objItemIds);
        } else if (diffValue instanceof DiffArrayValue) {
          const diffArrVal = diffValue;
          const childDst = diffValue.value as DataSubType;
          let objItemId = null;
          if (childDst != null) {
            objItemId = this.convertObjectItemId(childDst.similarAncesters.dataName, childDst.subType.typeName);
          }
          return new ObjectArrayFragment(pcField, diffArrVal.arrIindex, objItemId);
        } else {
          throw new InvalidArgumentError(`unknown instance type: ${typeof diffValue}`);
        }
      } else {
        const childDst = diffValue.value as DataSubType;
        let objItemId: ObjectItemId | null = null;
        if (childDst != null) {
          objItemId = this.convertObjectItemId(childDst.similarAncesters.dataName, childDst.subType.typeName);
        }
        return new ObjectItemFragment(pcField, objItemId);
      }
    } else if (field.systemType == SystemType.Unknown) {
      return this.convertDataItemFragment(field, dataSubType);
    } else if (field.isPrimitiveType) {
      if (field.isArray) {
        if (diffValue instanceof DiffArrayAllValues) {
          const data = diffValue.value as string[] | number[] | boolean[];
          return new PrimitiveArrayFullFragment(pcField, data);
        } else if (diffValue instanceof DiffArrayValue) {
          const diffArrVal = diffValue;
          const data = diffArrVal.value as string | number | boolean;
          return new PrimitiveArrayFragment(pcField, diffArrVal.arrIindex, data);
        } else {
          throw new InvalidArgumentError(`unknown instance type: ${typeof diffValue}`);
        }
      } else {
        const data = diffValue.value as string | number | boolean;
        return new PrimitiveItemFragment(pcField, data);
      }
    } else {
      throw new InvalidArgumentError(`systemType が不明: systemType=${field.systemType}`);
    }
  }

  convertFactoryRegistration(dataSubType: DataSubType): FactoryRegistrationFlagment {
    if (dataSubType.similar) {
      const dataItems = [];
      for (const diffValue of dataSubType.similar.diffValues) {
        dataItems.push(this.convertInheritDataItemFragment(diffValue, dataSubType));
      }
      if (!dataSubType.similar) {
        throw new InvalidArgumentError();
      }
      return new FactoryRegistrationInheritFlagment(
        this.convertObjectItemId(dataSubType.dataName, dataSubType.subType.typeName),
        this.convertObjectItemId(dataSubType.inheritDataSubType.dataName, dataSubType.subType.typeName),
        this.convertSubTypeFragment(dataSubType.subType),
        dataItems
      );
    } else {
      const dataItems = [];
      for (const field of dataSubType.subType.fields) {
        if (!dataSubType.hasValue(field.fieldName)) {
          continue;
        }
        dataItems.push(this.convertDataItemFragment(field, dataSubType));
      }
      return new FactoryRegistrationFlagment(
        this.convertObjectItemId(dataSubType.dataName, dataSubType.subType.typeName),
        this.convertSubTypeFragment(dataSubType.subType),
        dataItems
      );
    }
  }

  convertRegistrationGroupFragment(dataSubTypes: DataSubType[]): RegistrationGroupFragment {
    const factoryRegistrationFlagments = [];
    for (const dst of dataSubTypes) {
      factoryRegistrationFlagments.push(this.convertFactoryRegistration(dst));
    }
    return new RegistrationGroupFragment(this.registrationGroupNo++, factoryRegistrationFlagments);
  }

  convertTestDataCode(dataFile: DataFile): TestDataFragment {
    return new TestDataFragment(dataFile.baseFile, util.pascalCase(dataFile.rootDataSubType.dataName));
  }

  convert(parseResult: JsonParseResult): ProgramCode {
    const subTypeDefinitionFragments = [];
    for (const subType of parseResult.subTypes) {
      subTypeDefinitionFragments.push(this.convertSubTypeFragment(subType));
    }
    // 現時点では、グループは１つだけ
    const registrationGroupFragments = [];
    registrationGroupFragments.push(
      this.convertRegistrationGroupFragment(parseResult.dataSubTypesSortedByRegistration)
    );
    const dataIdConstantFragments = Array.from(this.uniqObjectDataId.keys());
    const testDataFragment = [];
    for (const dataFile of parseResult.dataFiles) {
      testDataFragment.push(this.convertTestDataCode(dataFile));
    }
    return new ProgramCode(
      subTypeDefinitionFragments,
      dataIdConstantFragments,
      registrationGroupFragments,
      testDataFragment
    );
  }
}
