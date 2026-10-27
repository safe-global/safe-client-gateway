// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { CLS_ID, ClsServiceManager } from 'nestjs-cls';
import {
  getSafeRequestIdHeaders,
  SAFE_REQUEST_ID_HEADER,
} from '#/datasources/network/safe-request-id-header.helper';

describe('getSafeRequestIdHeaders', () => {
  const cls = ClsServiceManager.getClsService();

  function getHeadersForRequest(requestId: string): Record<string, string> {
    return cls.run(() => {
      cls.set(CLS_ID, requestId);
      return getSafeRequestIdHeaders(cls);
    });
  }

  it('returns the request ID header', () => {
    const requestId = faker.string.uuid();

    expect(getHeadersForRequest(requestId)).toEqual({
      [SAFE_REQUEST_ID_HEADER]: requestId,
    });
  });

  it('returns no header outside of a request', () => {
    expect(getSafeRequestIdHeaders(cls)).toEqual({});
  });

  it.each([
    ['not a UUID', faker.string.alphanumeric()],
    [
      'a UUID with a line break',
      `${faker.string.uuid()}\r\n${faker.word.noun()}`,
    ],
  ])('returns no header if the request ID is %s', (_, requestId) => {
    expect(getHeadersForRequest(requestId)).toEqual({});
  });
});
