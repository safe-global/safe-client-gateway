import { Page } from '../page.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../__tests__/builder';

export function pageBuilder<T>(): IBuilder<Page<T>> {
  return Builder.new<Page<T>>()
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
