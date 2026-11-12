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

  const fakeRequestId = (): string => {
    return faker.string.hexadecimal({
      length: 32,
      casing: 'lower',
      prefix: '',
    });
  };

  it('returns the request ID header', () => {
    const requestId = fakeRequestId();

    expect(getHeadersForRequest(requestId)).toEqual({
      [SAFE_REQUEST_ID_HEADER]: requestId,
    });
  });

  it('returns no header outside of a request', () => {
    expect(getSafeRequestIdHeaders(cls)).toEqual({});
  });

  it.each([
    ['not hex', faker.string.alpha({ length: 32, casing: 'lower' })],
    ['uppercase', fakeRequestId().toUpperCase()],
    ['a dashed UUID', faker.string.uuid()],
    ['followed by a line break', `${fakeRequestId()}\r\n${faker.word.noun()}`],
  ])('returns no header if the request ID is %s', (_, requestId) => {
    expect(getHeadersForRequest(requestId)).toEqual({});
  });
});
