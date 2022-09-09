export interface IValidator<T> {
  validate(data: unknown): T;
  // TODO: deprecate validateMany in favor of: validatePage(data: unknown): Page<T>
  validateMany(data: unknown[]): T[];
}
