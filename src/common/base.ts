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
