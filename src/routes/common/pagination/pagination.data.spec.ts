import { cursorUrlFromLimitAndOffset, PaginationData } from './pagination.data';

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
      expect(actual.offset).toBe(undefined);
    });

    it('url with cursor, offset but no limit', async () => {
      const url = new URL('https://safe.global/?cursor=offset%3D1%26');

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(undefined);
      expect(actual.offset).toBe(1);
    });

    it('url with no cursor', async () => {
      const url = new URL('https://safe.global/?another_query=offset%3D1%26');

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(undefined);
      expect(actual.offset).toBe(undefined);
    });

    it('limit is not a number', async () => {
      const url = new URL(
        'https://safe.global/?cursor=limit%3Daa%26offset%3D2',
      );

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(undefined);
      expect(actual.offset).toBe(2);
    });

    it('offset is not a number', async () => {
      const url = new URL(
        'https://safe.global/?cursor=limit%3D1%26offset%3Daa',
      );

      const actual = PaginationData.fromCursor(url);

      expect(actual.limit).toBe(1);
      expect(actual.offset).toBe(undefined);
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
      expect(actual.offset).toBe(undefined);
    });

    it('url with offset but no limit', async () => {
      const url = new URL('https://safe.global/?offset=20');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(undefined);
      expect(actual.offset).toBe(20);
    });

    it('url with neither limit no offset', async () => {
      const url = new URL('https://safe.global/?another_query=test');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(undefined);
      expect(actual.offset).toBe(undefined);
    });

    it('limit is not a number', async () => {
      const url = new URL('https://safe.global/?limit=aa&offset=20');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(undefined);
      expect(actual.offset).toBe(20);
    });

    it('offset is not a number', async () => {
      const url = new URL('https://safe.global/?limit=10&offset=aa');

      const actual = PaginationData.fromLimitAndOffset(url);

      expect(actual.limit).toBe(10);
      expect(actual.offset).toBe(undefined);
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
      expect(actual).toStrictEqual(expected);
    });

    it('cursor is updated', async () => {
      const fromUrl = 'https://safe.global/?limit=10&offset=2';
      // base url has limit=0 and offset=1
      const baseUrl = 'https://base.url/?cursor=limit%3D0%26offset%3D1';

      const actual = cursorUrlFromLimitAndOffset(baseUrl, fromUrl);

      const expected = new URL(
        'https://base.url/?cursor=limit%3D10%26offset%3D2',
      );
      expect(actual).toStrictEqual(expected);
    });

    it('returns undefined when from is null', async () => {
      const baseUrl = 'https://base.url/';

      const actual = cursorUrlFromLimitAndOffset(baseUrl, null);

      expect(actual).toStrictEqual(null);
    });
  });
});
