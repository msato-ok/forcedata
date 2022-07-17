import { InvalidArgumentError } from '../common/base';
import { DataSubType, DataFile } from '../spec/data_file';
import { SubType, SystemType } from '../spec/sub_type';
import { JsonParseResult } from '../parser/parser';

export class Segmenter {
  segment(parseResult: JsonParseResult): Segment[] {
    const dstList = parseResult.uniqueDataSubTypes;
    const dfList = parseResult.getDataFilesByDataSubType(dstList);
    return [new Segment('initial', parseResult.uniqueDataSubTypes, dfList)];
  }
}

export class Segment {
  constructor(readonly name: string, readonly dataSubTypes: DataSubType[], readonly dataFiles: DataFile[]) {}

  uniqSubTypes(): SubType[] {
    const sts = new Set<SubType>();
    for (const dst of this.dataSubTypes) {
      sts.add(dst.subType);
    }
    return Array.from(sts.values());
  }

  /**
   * DataSubType が属する DataFile を取得する
   *
   * dst が json ファイル内でのルートモデルである場合に、それが属する DataFile を返す
   * ルートモデルではない場合 null を返す
   *
   * @param dsts
   * @returns
   */
  getDataFile(dataSubType: DataSubType) {
    for (const df of this.dataFiles) {
      if (df.rootDataSubType == dataSubType) {
        return df;
      }
    }
    return null;
  }

  /**
   * 登録順が並べ替えられたユニークなデータを取得する
   *
   * データが関連している場合に、先に登録されていることが前提となるような、
   * データ構造がある場合、その登録順の並べ替えをする
   */
  sortByRegistration(): DataSubType[] {
    const list: DataSubType[] = [];
    const listDict = new Map<string, DataSubType>();

    const walkField = (dst: DataSubType) => {
      const moving: DataSubType[] = [];
      for (const field of dst.subType.fields) {
        if (field.isPrimitiveType || field.systemType == SystemType.Unknown) {
          continue;
        }
        if (field.systemType == SystemType.Object) {
          let childDstArry: DataSubType[] = [];
          if (dst.hasValue(field.fieldName)) {
            if (field.isArray) {
              childDstArry = dst.getArrayDataSubType(field.fieldName);
            } else {
              const childDst = dst.getDataSubType(field.fieldName);
              childDstArry.push(childDst);
            }
          }
          for (let i = 0; i < childDstArry.length; i++) {
            const childDst = childDstArry[i];
            if (childDst.similar != null && childDst.similar.diffValues.length == 0) {
              continue;
            }
            moving.push(childDst);
            walkField(childDst);
          }
        } else {
          throw new InvalidArgumentError(`unknown systemType: ${field.systemType}`);
        }
      }
      for (const m of moving) {
        if (!listDict.has(m.dataName)) {
          listDict.set(m.dataName, m);
          list.push(m);
        }
      }
    };

    for (const dst of this.dataSubTypes) {
      if (listDict.has(dst.dataName)) {
        continue;
      }
      walkField(dst);
      list.push(dst);
    }
    if (this.dataSubTypes.length != list.length) {
      throw new InvalidArgumentError(`dataSubTypes=${this.dataSubTypes.length} != ${list.length}}`);
    }
    return list;
  }
}
