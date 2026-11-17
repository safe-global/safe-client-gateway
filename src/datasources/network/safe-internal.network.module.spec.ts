// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { CLS_ID, ClsServiceManager } from 'nestjs-cls';
import type { MockedFunction, MockedObject } from 'vitest';
import type { FetchClient } from '#/datasources/network/network.module';
import { createSafeInternalNetworkService } from '#/datasources/network/safe-internal.network.module';
import { SAFE_REQUEST_ID_HEADER } from '#/datasources/network/safe-request-id-header.helper';
import type { ILoggingService } from '#/logging/logging.interface';

const fetchClient = vi.fn();

const fetchClientMock: MockedFunction<FetchClient> = vi.mocked(fetchClient);

const loggingService = {
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

describe('createSafeInternalNetworkService', () => {
  const cls = ClsServiceManager.getClsService();
  const defaultHeaders = {
    Authorization: `Bearer ${faker.string.alphanumeric()}`,
  };
  const target = createSafeInternalNetworkService({
    client: fetchClientMock,
    loggingService,
    cls,
    defaultHeaders,
  });

  it('sends the request ID alongside the default headers', async () => {
    const requestId = faker.string.hexadecimal({
      length: 32,
      casing: 'lower',
      prefix: '',
    });
    const url = faker.internet.url({ appendSlash: false });

    await cls.run(() => {
      cls.set(CLS_ID, requestId);
      return target.get({ url });
    });

    expect(fetchClientMock).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'GET',
        headers: { ...defaultHeaders, [SAFE_REQUEST_ID_HEADER]: requestId },
      },
      undefined,
      undefined,
      undefined,
    );
  });

  it('sends only the default headers outside of a request', async () => {
    const url = faker.internet.url({ appendSlash: false });

    await target.get({ url });

    expect(fetchClientMock).toHaveBeenCalledWith(
      expect.any(String),
      { method: 'GET', headers: defaultHeaders },
      undefined,
      undefined,
      undefined,
    );
  });
});
