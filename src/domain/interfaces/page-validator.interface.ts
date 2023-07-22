import { Page } from '../entities/page.entity';

export interface IPageValidator<T> {
  validatePage(data: unknown): Page<T>;
}
