export interface HasKey {
  get key(): string;
}

export class Cache<T extends HasKey> {
  private _cache: Map<string, T> = new Map<string, T>();

  get(key: string): T | undefined {
    return this._cache.get(key);
  }

  add(obj: T) {
    if (this._cache.has(obj.key)) {
      const keys = Array.from(this._cache.keys()).join(',');
      throw new ValidationError(`(${obj.key}) はユニークにしてください [${keys}]`);
    }
    this._cache.set(obj.key, obj);
  }

  unique(obj: T): T {
    const cached = this._cache.get(obj.key);
    if (cached) {
      return cached;
    }
    this.add(obj);
    return obj;
  }

  addAll(objs: T[]) {
    for (const obj of objs) {
      this.add(obj);
    }
  }

  get size(): number {
    return this._cache.size;
  }

  values(): T[] {
    return Array.from(this._cache.values());
  }
}

export class ObjectPath implements HasKey {
  private static _cache = new Cache<ObjectPath>();

  protected _path: string;

  protected constructor(path: string) {
    this._path = path;
  }

  get isRoot(): boolean {
    return this._path == '';
  }

  get key(): string {
    return this._path;
  }

  get path(): string {
    return this._path;
  }

  append(suffixPath: string): ObjectPath {
    if (!this.isRoot) {
      suffixPath = '.' + suffixPath;
    }
    return new ObjectPath(this._path + suffixPath);
  }

  appendArrayIndex(i: number): ObjectPath {
    return new ObjectPath(`${this._path}[${i}]`);
  }

  static unique(path: string): ObjectPath {
    const obj = new ObjectPath(path);
    return this._cache.unique(obj);
  }
}

export class ObjectPathNoArrayIndex extends ObjectPath {
  private static _cacheNoArrayIndex = new Cache<ObjectPathNoArrayIndex>();

  static unique(path: string): ObjectPath {
    const obj = new ObjectPath(path);
    return this._cacheNoArrayIndex.unique(obj);
  }

  static fromObjectPath(opath: ObjectPath): ObjectPathNoArrayIndex {
    // 末尾に hoge.fuga[0] と配列の添字が付いてる場合は削除する
    const path = opath.path.replace(/(.*?)\[.*?\]/g, '$1');
    return this.unique(path);
  }
}

export class AppError extends Error {
  constructor(e?: string) {
    super(e);
    this.name = new.target.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {}

export class ParseError extends AppError {}

export class InvalidArgumentError extends AppError {}

/**
 * 実装上あり得ないエラー.
 * linter の undefined 対策など
 */
export class BugError extends AppError {
  constructor(e?: string) {
    if (!e) {
      e = 'ここでエラーになるのはバグ';
    }
    super(e);
  }
}
