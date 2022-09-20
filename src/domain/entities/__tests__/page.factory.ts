import { Page } from '../page.entity';
import { faker } from '@faker-js/faker';

export default function <T>(
  count?: number,
  next?: string,
  previous?: string,
  results?: T[],
): Page<T> {
  return <Page<T>>{
    count: count ?? faker.datatype.number(),
    next: next ?? limitAndOffsetUrlFactory(),
    previous: previous ?? limitAndOffsetUrlFactory(),
    results: results ?? [],
  };
}

export function limitAndOffsetUrlFactory(
  limit?: number,
  offset?: number,
  url?: string,
): string {
  const _url = new URL(url ?? faker.internet.url());
  if (limit) {
    _url.searchParams.set('limit', limit.toString());
  }
  if (offset) {
    _url.searchParams.set('offset', offset.toString());
  }
  return _url.toString();
}
