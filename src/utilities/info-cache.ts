export class CacheMap<T> {
  private static disabled = false;

  static disableCache() {
    CacheMap.disabled = true;
  }

  private _cache: Map<string, T> = new Map();

  set(id: string, info: T) {
    if (CacheMap.disabled) return;
    this._cache.set(id, info);
  }

  get(id: string) {
    if (CacheMap.disabled) return;
    return this._cache.get(id);
  }
}
