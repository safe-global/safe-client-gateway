export interface Builder<T> {
  /**
   * Returns the concrete class T using the internal Builder state
   */
  build(): T;

  /**
   * Returns the JSON-like implementation for the concrete class T using the
   * internal Builder state
   */
  toJson(): unknown;
}
