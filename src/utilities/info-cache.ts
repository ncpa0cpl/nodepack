export class CacheMap<T> {
  private _cache: Map<string, T> = new Map();

  set(id: string, info: T) {
    this._cache.set(id, info);
  }

  get(id: string) {
    return this._cache.get(id);
  }
}
