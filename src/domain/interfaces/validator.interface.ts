import { Page } from '@/domain/entities/page.entity';

export interface IValidator<T> {
  validate(data: unknown): T;
}

export interface IPageValidator<T> {
  validatePage(data: unknown): Page<T>;
}
