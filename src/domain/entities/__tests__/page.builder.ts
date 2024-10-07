import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Page } from '@/domain/entities/page.entity';

export function pageBuilder<T>(): IBuilder<Page<T>> {
  return new Builder<Page<T>>()
    .with('count', faker.number.int())
    .with('next', limitAndOffsetUrlFactory())
    .with('previous', limitAndOffsetUrlFactory())
    .with('results', []);
}

export function limitAndOffsetUrlFactory(
  limit?: number,
  offset?: number,
  url?: string,
): string {
  const _url = new URL(url ?? faker.internet.url({ appendSlash: false }));
  if (limit) {
    _url.searchParams.set('limit', limit.toString());
  }
  if (offset) {
    _url.searchParams.set('offset', offset.toString());
  }
  return _url.toString();
}
