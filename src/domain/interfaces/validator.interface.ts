export interface IValidator<T> {
  validate(data: unknown): T;
}
