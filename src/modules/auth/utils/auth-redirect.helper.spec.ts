// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { BadRequestException } from '@nestjs/common';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import {
  buildAuth0LogoutBaseUrl,
  getRedirectConfig,
  type RedirectConfig,
  resolveAndValidateRedirectUrl,
} from '@/modules/auth/utils/auth-redirect.helper';

describe('Auth-redirect helper functions', () => {
  describe('buildAuth0LogoutBaseUrl', () => {
    it('should return a logout URL when domain and clientId are set', () => {
      const domain = faker.internet.domainName();
      const clientId = faker.string.uuid();
      const config = new FakeConfigurationService();
      config.set('auth.auth0.domain', domain);
      config.set('auth.auth0.clientId', clientId);

      const result = buildAuth0LogoutBaseUrl(config);

      expect(result).toBe(`https://${domain}/v2/logout?client_id=${clientId}`);
    });

    it('should return null when domain is missing', () => {
      const config = new FakeConfigurationService();
      config.set('auth.auth0.clientId', faker.string.uuid());

      expect(buildAuth0LogoutBaseUrl(config)).toBeNull();
    });

    it('should return null when clientId is missing', () => {
      const config = new FakeConfigurationService();
      config.set('auth.auth0.domain', faker.internet.domainName());

      expect(buildAuth0LogoutBaseUrl(config)).toBeNull();
    });

    it('should return null when clientId is empty', () => {
      const config = new FakeConfigurationService();
      config.set('auth.auth0.domain', faker.internet.domainName());
      config.set('auth.auth0.clientId', '');

      expect(buildAuth0LogoutBaseUrl(config)).toBeNull();
    });

    it('should return null when clientId is whitespace-only', () => {
      const config = new FakeConfigurationService();
      config.set('auth.auth0.domain', faker.internet.domainName());
      config.set('auth.auth0.clientId', '   ');

      expect(buildAuth0LogoutBaseUrl(config)).toBeNull();
    });

    it('should trim whitespace from clientId', () => {
      const domain = faker.internet.domainName();
      const clientId = faker.string.uuid();
      const config = new FakeConfigurationService();
      config.set('auth.auth0.domain', domain);
      config.set('auth.auth0.clientId', `  ${clientId}  `);

      const result = buildAuth0LogoutBaseUrl(config);

      expect(result).toBe(`https://${domain}/v2/logout?client_id=${clientId}`);
    });
  });

  describe('getRedirectConfig', () => {
    it('should read redirect config from configuration service', () => {
      const postLoginRedirectUri = faker.internet.url();
      const allowedRedirectDomain = faker.internet.domainName();
      const config = new FakeConfigurationService();
      config.set('auth.postLoginRedirectUri', postLoginRedirectUri);
      config.set('auth.allowedRedirectDomain', allowedRedirectDomain);
      config.set('application.isProduction', false);

      const result = getRedirectConfig(config);

      expect(result).toEqual({
        postLoginRedirectUri,
        allowedRedirectDomain,
        isProduction: false,
      });
    });

    it('should throw when postLoginRedirectUri is missing', () => {
      const config = new FakeConfigurationService();
      config.set('application.isProduction', false);

      expect(() => getRedirectConfig(config)).toThrow();
    });
  });

  describe('resolveAndValidateRedirectUrl', () => {
    describe('production (same-origin check)', () => {
      let postLoginRedirectUri: string;
      let config: RedirectConfig;

      beforeEach(() => {
        postLoginRedirectUri = faker.internet.url({ appendSlash: false });
        config = {
          postLoginRedirectUri,
          isProduction: true,
        };
      });

      it('should return postLoginRedirectUri when no redirect given', () => {
        expect(resolveAndValidateRedirectUrl(config)).toBe(
          postLoginRedirectUri,
        );
        expect(resolveAndValidateRedirectUrl(config, undefined)).toBe(
          postLoginRedirectUri,
        );
      });

      it('should accept same-origin absolute URL', () => {
        const path = `/${faker.word.noun()}`;
        const url = `${postLoginRedirectUri}${path}`;

        expect(resolveAndValidateRedirectUrl(config, url)).toBe(url);
      });

      it('should accept relative path', () => {
        const path = `/${faker.word.noun()}`;

        expect(resolveAndValidateRedirectUrl(config, path)).toBe(
          `${postLoginRedirectUri}${path}`,
        );
      });

      it('should reject cross-origin URL', () => {
        const evilUrl = faker.internet.url({ appendSlash: false });

        expect(() => resolveAndValidateRedirectUrl(config, evilUrl)).toThrow(
          BadRequestException,
        );
      });

      it('should reject different subdomain in production', () => {
        const origin = new URL(postLoginRedirectUri);
        const subdomainUrl = `${origin.protocol}//other.${origin.host}/foo`;

        expect(() =>
          resolveAndValidateRedirectUrl(config, subdomainUrl),
        ).toThrow(BadRequestException);
      });
    });

    describe('non-production with allowedRedirectDomain', () => {
      let allowedDomain: string;
      let config: RedirectConfig;

      beforeEach(() => {
        allowedDomain = faker.internet.domainName();
        config = {
          postLoginRedirectUri: `https://app.${allowedDomain}`,
          allowedRedirectDomain: allowedDomain,
          isProduction: false,
        };
      });

      it('should accept subdomain of allowed domain', () => {
        const subdomain = faker.word.noun();
        const path = `/${faker.word.noun()}`;
        const url = `https://${subdomain}.${allowedDomain}${path}`;

        expect(resolveAndValidateRedirectUrl(config, url)).toBe(url);
      });

      it('should accept exact match of allowed domain', () => {
        const path = `/${faker.word.noun()}`;
        const url = `https://${allowedDomain}${path}`;

        expect(resolveAndValidateRedirectUrl(config, url)).toBe(url);
      });

      it.each([
        {
          reason: 'non-HTTPS',
          url: (): string => `http://app.${allowedDomain}`,
        },
        {
          reason: 'URL with userinfo',
          url: (): string =>
            `https://${faker.internet.domainName()}@${allowedDomain}`,
        },
        {
          reason: 'URL with port',
          url: (): string =>
            `https://app.${allowedDomain}:${faker.internet.port()}`,
        },
      ])('should reject $reason', ({ url }) => {
        expect(() => resolveAndValidateRedirectUrl(config, url())).toThrow(
          BadRequestException,
        );
      });

      it('should reject different domain', () => {
        expect(() =>
          resolveAndValidateRedirectUrl(config, faker.internet.url()),
        ).toThrow(BadRequestException);
      });
    });
  });
});
