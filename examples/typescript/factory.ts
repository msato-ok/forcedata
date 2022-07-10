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
      throw new InvalidArgumentError(`${dataId} は未登録`);
    }
    return data;
  }

  private getDataFn(dataId: DataId): Callback {
    const dataFn = this.cacheFn.get(dataId);
    if (!dataFn) {
      throw new InvalidArgumentError(`${dataId} は未登録`);
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
