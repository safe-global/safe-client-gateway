export class CacheDir {
  readonly key: string;
  readonly field: string;

  constructor(key: string, field: string) {
    this.key = key;
    this.field = field;
  }
}
