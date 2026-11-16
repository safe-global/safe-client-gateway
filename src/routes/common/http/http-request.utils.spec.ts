// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  getRouteUrl,
  type RequestLike,
} from '#/routes/common/http/http-request.utils';

describe('http-request.utils tests', () => {
  describe('getRouteUrl tests', () => {
    const get = vi.fn<(name: string) => string | undefined>();
    const request = {
      get,
      originalUrl: faker.system.filePath(),
      protocol: faker.internet.protocol(),
    } satisfies RequestLike;

    it('Uses X-Forwarded-Proto as protocol if set', () => {
      const protocol = faker.internet.protocol();
      const host = faker.internet.domainName();
      get.mockImplementation((arg) => {
        if (arg === 'X-Forwarded-Proto') {
          return protocol;
        }
        if (arg === 'Host') {
          return host;
        }
        throw Error('Unknown arg');
      });

      const actual = getRouteUrl(request).toString();

      expect(actual).toBe(`${protocol}://${host}${request.originalUrl}`);
    });

    it('Uses request protocol if X-Forwarded-Proto is not set', () => {
      const host = faker.internet.domainName();
      get.mockImplementation((arg) => {
        if (arg === 'X-Forwarded-Proto') {
          return undefined;
        }
        if (arg === 'Host') {
          return host;
        }
        throw Error('Unknown arg');
      });

      const actual = getRouteUrl(request).toString();

      expect(actual).toBe(
        `${request.protocol}://${host}${request.originalUrl}`,
      );
    });
  });
});
