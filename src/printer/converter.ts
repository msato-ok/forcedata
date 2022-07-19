import { SubType, SubTypeField, SystemType } from '../spec/sub_type';
import { DataSubType, DiffValue, DiffArrayAllValues, DiffArrayValue } from '../spec/data_file';
import { Cache, InvalidArgumentError } from '../common/base';
import { Segment } from '../parser/segmenter';
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

export class FactoryRegistrationFragment {
  constructor(
    readonly objectId: ObjectItemId,
    readonly subType: SubTypeFragment,
    readonly dataItems: DataItemFragment[]
  ) {}
}

export class FactoryRegistrationInheritFragment extends FactoryRegistrationFragment {
  constructor(
    readonly objectId: ObjectItemId,
    readonly inheritObjectId: ObjectItemId,
    readonly subType: SubTypeFragment,
    readonly dataItems: DataItemFragment[]
  ) {
    super(objectId, subType, dataItems);
  }
}

export class FragmentsGroupBySubType {
  constructor(
    readonly subTypeName: string,
    readonly factoryRegistrationFragments: FactoryRegistrationFragment[],
    readonly dataIdConstantFragments: string[]
  ) {}
}

export class RegistrationGroupFragment {
  private dataIdsGroupBySubType = new Map<string, Set<string>>();
  private fragmentsGroupBySubType = new Map<string, FactoryRegistrationFragment[]>();

  constructor(readonly groupName: string, readonly factoryRegistrationFragments: FactoryRegistrationFragment[]) {
    for (const fragment of factoryRegistrationFragments) {
      let fragments = this.fragmentsGroupBySubType.get(fragment.subType.subTypeName);
      if (!fragments) {
        fragments = [];
        this.fragmentsGroupBySubType.set(fragment.subType.subTypeName, fragments);
      }
      fragments.push(fragment);
      let dataIds = this.dataIdsGroupBySubType.get(fragment.subType.subTypeName);
      if (!dataIds) {
        dataIds = new Set<string>();
        this.dataIdsGroupBySubType.set(fragment.subType.subTypeName, dataIds);
      }
      dataIds.add(fragment.objectId.dataId);
    }
  }

  getFragmentsGroupBySubType(subTypeName: string): FactoryRegistrationFragment[] {
    const fragments = this.fragmentsGroupBySubType.get(subTypeName);
    if (!fragments) {
      throw new InvalidArgumentError();
    }
    return fragments;
  }

  getDataIdsGroupBySubType(subTypeName: string): string[] {
    const dataIds = this.dataIdsGroupBySubType.get(subTypeName);
    if (!dataIds) {
      throw new InvalidArgumentError();
    }
    return Array.from(dataIds);
  }

  get subTypeNames(): string[] {
    return Array.from(this.dataIdsGroupBySubType.keys());
  }
}

/**
 * json ファイル名とファイルのルートオブジェクトのデータIDの組み合わせ
 */
export class TestDataFragment {
  constructor(readonly fileName: string, readonly segmentName: string, readonly rootDataId: string) {}
}

export class ProgramCode {
  constructor(
    readonly subTypeDefinitionFragments: SubTypeFragment[],
    readonly registrationGroupFragments: RegistrationGroupFragment[],
    readonly testDataFragment: TestDataFragment[],
    readonly dataIdConstantFragments: string[]
  ) {}
}

export interface ProgramCodeConverter {
  convert(segments: Segment[]): ProgramCode;
}

export abstract class AbstractProgramCodeConverter implements ProgramCodeConverter {
  private uniqObjectDataId: Map<string, ObjectItemId> = new Map<string, ObjectItemId>();

  abstract convertSubTypeFieldFragment(field: SubTypeField): SubTypeFieldFragment;

  convertSubTypeFragment(subType: SubType): SubTypeFragment {
    const fields = [];
    for (const field of subType.fields) {
      fields.push(this.convertSubTypeFieldFragment(field));
    }
    return new SubTypeFragment(subType.typeName.name, fields);
  }

  convertDataId(dataName: string): string {
    return util.pascalCase(dataName);
  }

  convertObjectItemId(dataName: string, subType: SubType): ObjectItemId {
    const objItemId = {
      dataId: this.convertDataId(dataName),
      typeName: subType.typeName.name,
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
          const objItemId = this.convertObjectItemId(dst.similarAncesters.dataName, dst.subType);
          objItemIds.push(objItemId);
        }
        return new ObjectArrayFullFragment(fieldFr, objItemIds);
      } else {
        const dst = dataSubType.getDataSubType(subTypeField.fieldName);
        const objItemId = this.convertObjectItemId(dst.similarAncesters.dataName, dst.subType);
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
                const objItemId = this.convertObjectItemId(childDst.similarAncesters.dataName, childDst.subType);
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
            objItemId = this.convertObjectItemId(childDst.similarAncesters.dataName, childDst.subType);
          }
          return new ObjectArrayFragment(pcField, diffArrVal.arrIindex, objItemId);
        } else {
          throw new InvalidArgumentError(`unknown instance type: ${typeof diffValue}`);
        }
      } else {
        const childDst = diffValue.value as DataSubType;
        let objItemId: ObjectItemId | null = null;
        if (childDst != null) {
          objItemId = this.convertObjectItemId(childDst.similarAncesters.dataName, childDst.subType);
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

  convertFactoryRegistration(dataSubType: DataSubType): FactoryRegistrationFragment {
    if (dataSubType.similar) {
      const dataItems = [];
      for (const diffValue of dataSubType.similar.diffValues) {
        dataItems.push(this.convertInheritDataItemFragment(diffValue, dataSubType));
      }
      if (!dataSubType.similar) {
        throw new InvalidArgumentError();
      }
      return new FactoryRegistrationInheritFragment(
        this.convertObjectItemId(dataSubType.dataName, dataSubType.subType),
        this.convertObjectItemId(dataSubType.inheritDataSubType.dataName, dataSubType.subType),
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
      return new FactoryRegistrationFragment(
        this.convertObjectItemId(dataSubType.dataName, dataSubType.subType),
        this.convertSubTypeFragment(dataSubType.subType),
        dataItems
      );
    }
  }

  convertRegistrationGroupFragment(segment: Segment): RegistrationGroupFragment {
    const dataSubTypes = segment.sortByRegistration();
    const factoryRegistrationFragments = [];
    for (const dst of dataSubTypes) {
      const fragment = this.convertFactoryRegistration(dst);
      factoryRegistrationFragments.push(fragment);
    }
    return new RegistrationGroupFragment(segment.name, factoryRegistrationFragments);
  }

  convertTestDataCode(segments: Segment[]): TestDataFragment[] {
    const dataList = [];
    for (const segment of segments) {
      for (const dst of segment.dataSubTypes) {
        const df = segment.getDataFile(dst);
        if (df) {
          const tdf = new TestDataFragment(df.baseFile, segment.name, this.convertDataId(dst.dataName));
          dataList.push(tdf);
        }
      }
    }
    return dataList;
  }

  private uniqSubTypes(segments: Segment[]): SubType[] {
    const cache: Cache<SubType> = new Cache<SubType>();
    for (const segment of segments) {
      cache.addAll(segment.uniqSubTypes());
    }
    return cache.values();
  }

  convert(segments: Segment[]): ProgramCode {
    const subTypeDefinitionFragments = [];
    for (const subType of this.uniqSubTypes(segments)) {
      subTypeDefinitionFragments.push(this.convertSubTypeFragment(subType));
    }
    // 現時点では、グループは１つだけ
    const registrationGroupFragments = [];
    const dataIds = new Set<string>();
    for (const segment of segments) {
      const group = this.convertRegistrationGroupFragment(segment);
      registrationGroupFragments.push(group);
      for (const frf of group.factoryRegistrationFragments) {
        dataIds.add(frf.objectId.dataId);
      }
    }
    const testDataFragment = this.convertTestDataCode(segments);
    // for (const segment of segments) {
    //   testDataFragment = testDataFragment.concat();
    // }
    return new ProgramCode(
      subTypeDefinitionFragments,
      registrationGroupFragments,
      testDataFragment,
      Array.from(dataIds)
    );
  }
}
