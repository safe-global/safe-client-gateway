import { faker } from '@faker-js/faker';
import {
  buildNextPageURL,
  buildPreviousPageURL,
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from './pagination.data';

describe('PaginationData', () => {
  describe('fromCursor', () => {
    it('url with cursor, limit and offset', async () => {
      const url = new URL('https://safe.global/?cursor=limit%3D1%26offset%3D2');

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(1);
      expect(actual.offset).toBe(2);
    });

    it('url with cursor, limit but no offset', async () => {
      const url = new URL('https://safe.global/?cursor=limit%3D1%26');

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(1);
      expect(actual.offset).toBe(PaginationData.DEFAULT_OFFSET);
    });

    it('url with cursor, offset but no limit', async () => {
      const url = new URL('https://safe.global/?cursor=offset%3D1%26');

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(PaginationData.DEFAULT_LIMIT);
      expect(actual.offset).toBe(1);
    });

    it('url with no cursor', async () => {
      const url = new URL('https://safe.global/?another_query=offset%3D1%26');

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(PaginationData.DEFAULT_LIMIT);
      expect(actual.offset).toBe(PaginationData.DEFAULT_OFFSET);
    });

    it('limit is not a number', async () => {
      const url = new URL(
        'https://safe.global/?cursor=limit%3Daa%26offset%3D2',
      );

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(PaginationData.DEFAULT_LIMIT);
      expect(actual.offset).toBe(2);
    });

    it('offset is not a number', async () => {
      const url = new URL(
        'https://safe.global/?cursor=limit%3D1%26offset%3Daa',
      );

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(1);
      expect(actual.offset).toBe(PaginationData.DEFAULT_OFFSET);
    });
  });

  describe('fromLimitAndOffset', () => {
    it('url with limit and offset', async () => {
      const url = new URL('https://safe.global/?limit=10&offset=20');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(10);
      expect(actual.offset).toBe(20);
    });

    it('url with limit but no offset', async () => {
      const url = new URL('https://safe.global/?limit=10');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(10);
      expect(actual.offset).toBe(PaginationData.DEFAULT_OFFSET);
    });

    it('url with offset but no limit', async () => {
      const url = new URL('https://safe.global/?offset=20');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(PaginationData.DEFAULT_LIMIT);
      expect(actual.offset).toBe(20);
    });

    it('url with neither limit no offset', async () => {
      const url = new URL('https://safe.global/?another_query=test');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(PaginationData.DEFAULT_LIMIT);
      expect(actual.offset).toBe(PaginationData.DEFAULT_OFFSET);
    });

    it('limit is not a number', async () => {
      const url = new URL('https://safe.global/?limit=aa&offset=20');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(PaginationData.DEFAULT_LIMIT);
      expect(actual.offset).toBe(20);
    });

    it('offset is not a number', async () => {
      const url = new URL('https://safe.global/?limit=10&offset=aa');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(10);
      expect(actual.offset).toBe(PaginationData.DEFAULT_OFFSET);
    });
  });

  describe('cursorUrlFromLimitAndOffset', () => {
    it('url is generated correctly', async () => {
      const fromUrl = 'https://safe.global/?limit=10&offset=2';
      const baseUrl = 'https://base.url/';

      const actual = cursorUrlFromLimitAndOffset(baseUrl, fromUrl);

      const expected = new URL(
        'https://base.url/?cursor=limit%3D10%26offset%3D2',
      );
      expect(actual?.href).toStrictEqual(expected.href);
    });

    it('cursor is updated', async () => {
      const fromUrl = 'https://safe.global/?limit=10&offset=2';
      // base url has limit=0 and offset=1
      const baseUrl = 'https://base.url/?cursor=limit%3D0%26offset%3D1';

      const actual = cursorUrlFromLimitAndOffset(baseUrl, fromUrl);

      const expected = new URL(
        'https://base.url/?cursor=limit%3D10%26offset%3D2',
      );
      expect(actual?.href).toStrictEqual(expected.href);
    });

    it('returns null when from is null', async () => {
      const baseUrl = 'https://base.url/';

      const actual = cursorUrlFromLimitAndOffset(baseUrl, null);

      expect(actual).toStrictEqual(null);
    });
  });

  describe('buildNextPageURL', () => {
    it('next url is the default if no cursor is passed', async () => {
      const currentUrl = faker.internet.url({ appendSlash: false });
      const expected = new URL(
        `${currentUrl}/?cursor=limit%3D${
          PaginationData.DEFAULT_LIMIT
        }%26offset%3D${
          PaginationData.DEFAULT_LIMIT + PaginationData.DEFAULT_OFFSET
        }`,
      );

      const actual = buildNextPageURL(
        currentUrl,
        faker.number.int({ min: PaginationData.DEFAULT_LIMIT + 1 }),
      );

      expect(actual?.href).toStrictEqual(expected.href);
    });

    it('next url is the default if an invalid cursor is passed', async () => {
      const base = faker.internet.url({ appendSlash: false });
      const currentUrl = new URL(`${base}/?cursor=${faker.word.sample()}`);
      const expected = new URL(
        `${base}/?cursor=limit%3D${PaginationData.DEFAULT_LIMIT}%26offset%3D${
          PaginationData.DEFAULT_LIMIT + PaginationData.DEFAULT_OFFSET
        }`,
      );

      const actual = buildNextPageURL(
        currentUrl,
        faker.number.int({ min: PaginationData.DEFAULT_LIMIT + 1 }),
      );

      expect(actual?.href).toStrictEqual(expected.href);
    });

    it('next url is null if an invalid cursor is passed but there is no next page', async () => {
      const currentUrl = new URL(
        `${faker.internet.url({
          appendSlash: false,
        })}/?cursor=limit%3D${faker.word.sample()}%26offset%3D${faker.word.sample()}`,
      );

      const actual = buildNextPageURL(
        currentUrl,
        faker.number.int({ max: 20 }),
      );

      expect(actual).toStrictEqual(null);
    });

    it('next url is null if items count is equal to next offset', async () => {
      const limit = faker.number.int({ min: 1, max: 100 });
      const offset = faker.number.int({ min: 1, max: 100 });
      const itemsCount = limit + offset;
      const currentUrl = new URL(
        `${faker.internet.url({
          appendSlash: false,
        })}/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      );

      const actual = buildNextPageURL(currentUrl, itemsCount);

      expect(actual).toStrictEqual(null);
    });

    it('next url is null if items count is less than next offset', async () => {
      const limit = faker.number.int({ min: 1, max: 100 });
      const offset = faker.number.int({ min: 1, max: 100 });
      const itemsCount = faker.number.int({ max: limit + offset - 1 });
      const currentUrl = new URL(
        `${faker.internet.url({
          appendSlash: false,
        })}/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      );

      const actual = buildNextPageURL(currentUrl, itemsCount);

      expect(actual).toStrictEqual(null);
    });

    it('next url contains a new offset and the same limit', async () => {
      const limit = faker.number.int({ min: 1, max: 100 });
      const offset = faker.number.int({ min: 1, max: 100 });
      const expectedOffset = limit + offset;
      const itemsCount = faker.number.int({ min: limit + offset + 1 });
      const base = faker.internet.url({ appendSlash: false });
      const currentUrl = new URL(
        `${base}/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      );
      const expected = new URL(
        `${base}/?cursor=limit%3D${limit}%26offset%3D${expectedOffset}`,
      );

      const actual = buildNextPageURL(currentUrl, itemsCount);

      expect(actual?.href).toStrictEqual(expected.href);
    });
  });

  describe('buildPreviousPageURL', () => {
    it('previous url is null if no cursor is passed', async () => {
      const currentUrl = new URL(
        `${faker.internet.url({ appendSlash: false })}`,
      );

      const actual = buildPreviousPageURL(currentUrl);

      expect(actual).toStrictEqual(null);
    });

    it('previous url is null if an invalid cursor is passed', async () => {
      const currentUrl = new URL(
        `${faker.internet.url({
          appendSlash: false,
        })}/?cursor=${faker.word.sample()}`,
      );

      const actual = buildPreviousPageURL(currentUrl);

      expect(actual).toStrictEqual(null);
    });

    it('previous url is null if an invalid cursor is passed (2)', async () => {
      const currentUrl = new URL(
        `${faker.internet.url({
          appendSlash: false,
        })}/?cursor=limit%3D${faker.word.sample()}%26offsetlimit%3D${faker.word.sample()}`,
      );

      const actual = buildPreviousPageURL(currentUrl);

      expect(actual).toStrictEqual(null);
    });

    it('previous url is null if offset is zero', async () => {
      const currentUrl = new URL(
        `${faker.internet.url({
          appendSlash: false,
        })}/?cursor=limit%3D3%26offset%3D0`,
      );

      const actual = buildPreviousPageURL(currentUrl);

      expect(actual).toStrictEqual(null);
    });

    it('previous url contains a zero offset if limit >= offset', async () => {
      const limit = faker.number.int({ min: 2, max: 100 });
      const offset = faker.number.int({ min: 1, max: limit });
      const base = faker.internet.url({ appendSlash: false });
      const currentUrl = new URL(
        `${base}/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      );
      const expected = new URL(`${base}/?cursor=limit%3D${limit}%26offset%3D0`);

      const actual = buildPreviousPageURL(currentUrl);

      expect(actual?.href).toStrictEqual(expected.href);
    });

    it('previous url contains a new offset and the same limit', async () => {
      const limit = faker.number.int({ min: 1, max: 100 });
      const offset = faker.number.int({ min: limit + 1 });
      const expectedOffset = offset - limit;
      const base = faker.internet.url({ appendSlash: false });
      const currentUrl = new URL(
        `${base}/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      );
      const expected = new URL(
        `${base}/?cursor=limit%3D${limit}%26offset%3D${expectedOffset}`,
      );

      const actual = buildPreviousPageURL(currentUrl);

      expect(actual?.href).toStrictEqual(expected.href);
    });
  });
});
