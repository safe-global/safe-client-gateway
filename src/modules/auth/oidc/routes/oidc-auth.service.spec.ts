// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import type { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import { OidcAuthService } from '@/modules/auth/oidc/routes/oidc-auth.service';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserEmailAlreadyInUseError } from '@/modules/users/domain/errors/user-email-already-in-use.error';

const authRepositoryMock = {
  signToken: jest.fn(),
  verifyToken: jest.fn(),
  decodeToken: jest.fn(),
} as jest.MockedObjectDeep<IAuthRepository>;

const usersRepositoryMock = {
  findOrCreateByExtUserId: jest.fn(),
  assertEmailCanBeUsedByUser: jest.fn(),
  persistVerifiedEmail: jest.fn(),
} as jest.MockedObjectDeep<IUsersRepository>;

const auth0RepositoryMock = {
  getAuthorizationUrl: jest.fn(),
  authenticateWithAuthorizationCode: jest.fn(),
} as jest.MockedObjectDeep<IAuth0Repository>;

describe('OidcAuthService', () => {
  let target: OidcAuthService;
  let maxValidityPeriodInSeconds: number;
  let stateTtlMs: number;
  let postLoginRedirectUri: string;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    maxValidityPeriodInSeconds = faker.number.int({ min: 3600, max: 86400 });
    stateTtlMs = faker.number.int({ min: 60_000, max: 300_000 });
    postLoginRedirectUri = faker.internet.url();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'auth.maxValidityPeriodSeconds',
      maxValidityPeriodInSeconds,
    );
    fakeConfigurationService.set('auth.stateTtlMs', stateTtlMs);
    fakeConfigurationService.set(
      'auth.postLoginRedirectUri',
      postLoginRedirectUri,
    );
    fakeConfigurationService.set('application.isProduction', false);

    target = new OidcAuthService(
      authRepositoryMock,
      fakeConfigurationService,
      usersRepositoryMock,
      auth0RepositoryMock,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('authenticateWithOidc', () => {
    it('should return an access token with expiration time from OIDC token', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const exp = new Date(
        now.getTime() + (maxValidityPeriodInSeconds - 60) * 1_000,
      );
      const nbf = new Date(now.getTime() - 60_000);
      const iat = new Date(now.getTime() - 30_000);
      const accessToken = faker.string.alphanumeric(64);

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        exp,
        nbf,
        iat,
      });
      usersRepositoryMock.findOrCreateByExtUserId.mockResolvedValue(userId);
      authRepositoryMock.signToken.mockReturnValue(accessToken);

      const result = await target.authenticateWithOidc(
        faker.string.alphanumeric(32),
      );

      expect(result).toEqual(expect.objectContaining({ accessToken }));
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        {
          auth_method: AuthMethod.Oidc,
          sub: userId.toString(),
        },
        {
          nbf,
          exp,
          iat,
        },
      );
      expect(usersRepositoryMock.findOrCreateByExtUserId).toHaveBeenCalledWith(
        extUserId,
      );
    });

    it('should use max expiration time when OIDC token has no exp', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const accessToken = faker.string.alphanumeric(64);

      const maxExpiration = new Date(
        now.getTime() + maxValidityPeriodInSeconds * 1_000,
      );

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        exp: undefined,
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserId.mockResolvedValue(userId);
      authRepositoryMock.signToken.mockReturnValue(accessToken);

      const result = await target.authenticateWithOidc(
        faker.string.alphanumeric(32),
      );

      expect(result).toEqual(expect.objectContaining({ accessToken }));
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        {
          auth_method: AuthMethod.Oidc,
          sub: userId.toString(),
        },
        {
          nbf: undefined,
          exp: maxExpiration,
          iat: new Date(),
        },
      );
      expect(usersRepositoryMock.findOrCreateByExtUserId).toHaveBeenCalledWith(
        extUserId,
      );
    });

    it('should persist a verified email after finding or creating the user', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const email = faker.internet.email().toLowerCase();

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: true,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserId.mockResolvedValue(userId);
      authRepositoryMock.signToken.mockReturnValue('token');

      await target.authenticateWithOidc(faker.string.alphanumeric(32));

      expect(usersRepositoryMock.findOrCreateByExtUserId).toHaveBeenCalledWith(
        extUserId,
      );
      expect(
        usersRepositoryMock.assertEmailCanBeUsedByUser,
      ).not.toHaveBeenCalled();
      expect(usersRepositoryMock.persistVerifiedEmail).toHaveBeenCalledWith(
        userId,
        email,
      );
    });

    it('should not persist an unverified email', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const email = faker.internet.email().toLowerCase();

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: false,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserId.mockResolvedValue(userId);
      authRepositoryMock.signToken.mockReturnValue('token');

      await target.authenticateWithOidc(faker.string.alphanumeric(32));

      expect(usersRepositoryMock.findOrCreateByExtUserId).toHaveBeenCalledWith(
        extUserId,
      );
      expect(
        usersRepositoryMock.assertEmailCanBeUsedByUser,
      ).toHaveBeenCalledWith(userId, email);
      expect(usersRepositoryMock.persistVerifiedEmail).not.toHaveBeenCalled();
    });

    it('should not persist when email is verified but missing', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const accessToken = faker.string.alphanumeric(64);

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email_verified: true,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserId.mockResolvedValue(userId);
      usersRepositoryMock.persistVerifiedEmail.mockRejectedValue(
        new UserEmailAlreadyInUseError(),
      );
      authRepositoryMock.signToken.mockReturnValue(accessToken);

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).resolves.toEqual(expect.objectContaining({ accessToken }));

      expect(usersRepositoryMock.findOrCreateByExtUserId).toHaveBeenCalledWith(
        extUserId,
      );
      expect(
        usersRepositoryMock.assertEmailCanBeUsedByUser,
      ).not.toHaveBeenCalled();
      expect(usersRepositoryMock.persistVerifiedEmail).not.toHaveBeenCalled();
    });

    it('should fail authentication when unverified email ownership conflicts', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const email = faker.internet.email().toLowerCase();
      const error = new UserEmailAlreadyInUseError();

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: false,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserId.mockResolvedValue(userId);
      usersRepositoryMock.assertEmailCanBeUsedByUser.mockRejectedValue(error);

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(error);

      expect(usersRepositoryMock.findOrCreateByExtUserId).toHaveBeenCalledWith(
        extUserId,
      );
      expect(
        usersRepositoryMock.assertEmailCanBeUsedByUser,
      ).toHaveBeenCalledWith(userId, email);
      expect(usersRepositoryMock.persistVerifiedEmail).not.toHaveBeenCalled();
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should fail authentication when verified email persistence fails internally', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const email = faker.internet.email().toLowerCase();
      const error = new InternalServerErrorException();

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: true,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserId.mockResolvedValue(userId);
      usersRepositoryMock.persistVerifiedEmail.mockRejectedValue(error);

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(error);

      expect(
        usersRepositoryMock.assertEmailCanBeUsedByUser,
      ).not.toHaveBeenCalled();
      expect(usersRepositoryMock.persistVerifiedEmail).toHaveBeenCalledWith(
        userId,
        email,
      );
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when exp exceeds max', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const exp = new Date(
        now.getTime() + (maxValidityPeriodInSeconds + 60) * 1_000,
      );

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        exp,
        nbf: undefined,
        iat: undefined,
      });

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(ForbiddenException);

      expect(
        usersRepositoryMock.findOrCreateByExtUserId,
      ).not.toHaveBeenCalled();
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should not throw when exp equals max validity', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const exp = new Date(now.getTime() + maxValidityPeriodInSeconds * 1_000);

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        exp,
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserId.mockResolvedValue(userId);
      authRepositoryMock.signToken.mockReturnValue('token');

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).resolves.toEqual(expect.objectContaining({ accessToken: 'token' }));
    });

    it('should propagate errors from authenticateWithAuthorizationCode', async () => {
      const error = new Error('Auth0 exchange failed');
      auth0RepositoryMock.authenticateWithAuthorizationCode.mockRejectedValue(
        error,
      );

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(error);

      expect(
        usersRepositoryMock.findOrCreateByExtUserId,
      ).not.toHaveBeenCalled();
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should propagate errors from findOrCreateByExtUserId', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      const error = new Error('Database connection failed');
      usersRepositoryMock.findOrCreateByExtUserId.mockRejectedValue(error);

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(error);

      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });
  });

  describe('createOidcAuthorizationRequest', () => {
    it('should return authorizationUrl, stateMaxAge and base64url-encoded state with csrf token', () => {
      const authorizationUrl = faker.internet.url();
      auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(authorizationUrl);

      const result = target.createOidcAuthorizationRequest();

      expect(result.authorizationUrl).toBe(authorizationUrl);
      expect(result.stateMaxAge).toBe(stateTtlMs);

      const decoded = JSON.parse(
        Buffer.from(result.state, 'base64url').toString('utf-8'),
      );
      expect(decoded.csrf).toHaveLength(64); // 32 bytes hex-encoded
      expect(decoded.redirectUrl).toBeUndefined();
      expect(auth0RepositoryMock.getAuthorizationUrl).toHaveBeenCalledWith(
        result.state,
        undefined,
      );
    });

    it('should pass connection through to the repository', () => {
      const authorizationUrl = faker.internet.url();
      auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(authorizationUrl);

      const result = target.createOidcAuthorizationRequest(
        undefined,
        'google-oauth2',
      );

      expect(result.authorizationUrl).toBe(authorizationUrl);
      expect(auth0RepositoryMock.getAuthorizationUrl).toHaveBeenCalledWith(
        result.state,
        'google-oauth2',
      );
    });

    it('should encode redirectUrl in the state', () => {
      const authorizationUrl = faker.internet.url();
      auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(authorizationUrl);

      const redirectUrl = new URL('/settings', postLoginRedirectUri).toString();
      const result = target.createOidcAuthorizationRequest(redirectUrl);

      const decoded = JSON.parse(
        Buffer.from(result.state, 'base64url').toString('utf-8'),
      );
      expect(decoded.csrf).toHaveLength(64);
      expect(decoded.redirectUrl).toBe(redirectUrl);
    });

    it('should resolve a relative path to an absolute URL', () => {
      const authorizationUrl = faker.internet.url();
      auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(authorizationUrl);

      const path = `/${faker.word.noun()}`;
      const result = target.createOidcAuthorizationRequest(path);

      const decoded = JSON.parse(
        Buffer.from(result.state, 'base64url').toString('utf-8'),
      );
      const expectedUrl = new URL(path, postLoginRedirectUri).toString();
      expect(decoded.redirectUrl).toBe(expectedUrl);
    });

    it('should throw BadRequestException for cross-origin redirectUrl', () => {
      expect(() =>
        target.createOidcAuthorizationRequest('https://evil.com/phish'),
      ).toThrow(BadRequestException);
    });

    describe('with allowedRedirectDomain, test env', () => {
      let domainTarget: OidcAuthService;
      const allowedDomain = '5afe.dev';

      beforeEach(() => {
        const fakeConfigurationService = new FakeConfigurationService();
        fakeConfigurationService.set(
          'auth.maxValidityPeriodSeconds',
          maxValidityPeriodInSeconds,
        );
        fakeConfigurationService.set('auth.stateTtlMs', stateTtlMs);
        fakeConfigurationService.set(
          'auth.postLoginRedirectUri',
          `https://safe-wallet-web.dev.${allowedDomain}/welcome`,
        );
        fakeConfigurationService.set(
          'auth.allowedRedirectDomain',
          allowedDomain,
        );
        fakeConfigurationService.set('application.isProduction', false);

        domainTarget = new OidcAuthService(
          authRepositoryMock,
          fakeConfigurationService,
          usersRepositoryMock,
          auth0RepositoryMock,
        );
      });

      it('should accept a subdomain of the allowed domain', () => {
        auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(
          faker.internet.url(),
        );

        const redirectUrl = `https://feat_branch--walletweb.review.${allowedDomain}/welcome/spaces`;
        const result = domainTarget.createOidcAuthorizationRequest(redirectUrl);

        const decoded = JSON.parse(
          Buffer.from(result.state, 'base64url').toString('utf-8'),
        );
        expect(decoded.redirectUrl).toBe(redirectUrl);
      });

      it('should accept the exact allowed domain', () => {
        auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(
          faker.internet.url(),
        );

        const redirectUrl = `https://${allowedDomain}/settings`;
        const result = domainTarget.createOidcAuthorizationRequest(redirectUrl);

        const decoded = JSON.parse(
          Buffer.from(result.state, 'base64url').toString('utf-8'),
        );
        expect(decoded.redirectUrl).toBe(redirectUrl);
      });

      it('should reject a different domain', () => {
        expect(() =>
          domainTarget.createOidcAuthorizationRequest('https://evil.com/phish'),
        ).toThrow(BadRequestException);
      });

      it('should reject a domain that only contains the suffix as a substring', () => {
        expect(() =>
          domainTarget.createOidcAuthorizationRequest(
            `https://evil-${allowedDomain}/phish`,
          ),
        ).toThrow(BadRequestException);
      });

      it('should accept a deeply nested subdomain', () => {
        auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(
          faker.internet.url(),
        );

        const redirectUrl = `https://a.b.c.${allowedDomain}/welcome`;
        const result = domainTarget.createOidcAuthorizationRequest(redirectUrl);

        const decoded = JSON.parse(
          Buffer.from(result.state, 'base64url').toString('utf-8'),
        );
        expect(decoded.redirectUrl).toBe(redirectUrl);
      });

      it('should resolve a relative path against postLoginRedirectUri', () => {
        auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(
          faker.internet.url(),
        );

        const path = `/${faker.word.noun()}`;
        const result = domainTarget.createOidcAuthorizationRequest(path);

        const decoded = JSON.parse(
          Buffer.from(result.state, 'base64url').toString('utf-8'),
        );
        expect(decoded.redirectUrl).toBe(
          `https://safe-wallet-web.dev.${allowedDomain}${path}`,
        );
      });

      it('should reject a non-HTTPS URL', () => {
        expect(() =>
          domainTarget.createOidcAuthorizationRequest(
            `http://${allowedDomain}/settings`,
          ),
        ).toThrow(BadRequestException);
      });

      it('should reject a URL with userinfo even if hostname matches', () => {
        expect(() =>
          domainTarget.createOidcAuthorizationRequest(
            `https://attacker.com@${allowedDomain}/phish`,
          ),
        ).toThrow(BadRequestException);
      });

      it('should reject a URL with a port', () => {
        expect(() =>
          domainTarget.createOidcAuthorizationRequest(
            `https://${allowedDomain}:8080/settings`,
          ),
        ).toThrow(BadRequestException);
      });
    });

    describe('with allowedRedirectDomain, production env', () => {
      it('should ignore allowedRedirectDomain and fall back to exact-origin check', () => {
        const fakeConfigurationService = new FakeConfigurationService();
        fakeConfigurationService.set(
          'auth.maxValidityPeriodSeconds',
          maxValidityPeriodInSeconds,
        );
        fakeConfigurationService.set('auth.stateTtlMs', stateTtlMs);
        fakeConfigurationService.set(
          'auth.postLoginRedirectUri',
          `https://app.5afe.dev/welcome`,
        );
        fakeConfigurationService.set('auth.allowedRedirectDomain', '5afe.dev');
        fakeConfigurationService.set('application.isProduction', true);

        const prodTarget = new OidcAuthService(
          authRepositoryMock,
          fakeConfigurationService,
          usersRepositoryMock,
          auth0RepositoryMock,
        );

        // A subdomain that would pass the domain-suffix check should be
        // rejected because production uses exact-origin matching instead.
        expect(() =>
          prodTarget.createOidcAuthorizationRequest(
            'https://preview.5afe.dev/settings',
          ),
        ).toThrow(BadRequestException);
      });
    });
  });

  describe('getPostLoginRedirectUri', () => {
    it('should return the configured redirect URI when called without state', () => {
      expect(target.getPostLoginRedirectUri()).toBe(postLoginRedirectUri);
    });

    it('should return the configured redirect URI when state has no redirectUrl', () => {
      const state = Buffer.from(
        JSON.stringify({
          csrf: faker.string.hexadecimal({
            length: 64,
            casing: 'lower',
            prefix: '',
          }),
        }),
      ).toString('base64url');
      expect(target.getPostLoginRedirectUri(state)).toBe(postLoginRedirectUri);
    });

    it('should return redirectUrl from state when present and same-origin', () => {
      const redirectUrl = new URL(
        '/dashboard',
        postLoginRedirectUri,
      ).toString();
      const state = Buffer.from(
        JSON.stringify({
          csrf: faker.string.hexadecimal({
            length: 64,
            casing: 'lower',
            prefix: '',
          }),
          redirectUrl,
        }),
      ).toString('base64url');

      expect(target.getPostLoginRedirectUri(state)).toBe(redirectUrl);
    });

    it('should throw UnauthorizedException for malformed state', () => {
      expect(() => target.getPostLoginRedirectUri('not-valid-base64!')).toThrow(
        UnauthorizedException,
      );
    });
  });
});
