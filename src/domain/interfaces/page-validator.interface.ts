import { Page } from '@/domain/entities/page.entity';

export interface IPageValidator<T> {
  validatePage(data: unknown): Page<T>;
}
