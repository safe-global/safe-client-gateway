// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { oidcAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import {
  AuthMethod,
  AuthPayload,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import type { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import { auth0TokenBuilder } from '@/modules/auth/oidc/auth0/domain/entities/__tests__/auth0-token.entity.builder';
import { OidcAuthService } from '@/modules/auth/oidc/routes/oidc-auth.service';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

const authRepositoryMock = {
  signToken: vi.fn(),
  verifyToken: vi.fn(),
  decodeToken: vi.fn(),
} as MockedObject<IAuthRepository>;

const usersRepositoryMock = {
  findOrCreateByExtUserIdAndEmail: vi.fn(),
  findOneOrFail: vi.fn(),
  findEmailById: vi.fn(),
} as MockedObject<IUsersRepository>;

const loggingServiceMock: MockedObject<ILoggingService> = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const auth0RepositoryMock = {
  getAuthorizationUrl: vi.fn(),
  authenticateWithAuthorizationCode: vi.fn(),
  listUserAuthenticationMethods: vi.fn(),
  deleteUserAuthenticationMethod: vi.fn(),
} as MockedObject<IAuth0Repository>;

describe('OidcAuthService', () => {
  let target: OidcAuthService;
  let maxValidityPeriodInSeconds: number;
  let stateTtlMs: number;
  let postLoginRedirectUri: string;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

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
      loggingServiceMock,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('authenticateWithOidc', () => {
    it('should return an access token with expiration time from OIDC token', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const email = fakeEmailAddress();
      const exp = new Date(
        now.getTime() + (maxValidityPeriodInSeconds - 60) * 1_000,
      );
      const nbf = new Date(now.getTime() - 60_000);
      const iat = new Date(now.getTime() - 30_000);
      const accessToken = faker.string.alphanumeric(64);

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: true,
        exp,
        nbf,
        iat,
      });
      usersRepositoryMock.findOrCreateByExtUserIdAndEmail.mockResolvedValue(
        userId,
      );
      authRepositoryMock.signToken.mockReturnValue(accessToken);

      const result = await target.authenticateWithOidc(
        faker.string.alphanumeric(32),
      );

      expect(result).toEqual(expect.objectContaining({ accessToken }));
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.objectContaining({
          auth_method: AuthMethod.Oidc,
          sub: userId.toString(),
        }),
        {
          nbf,
          exp,
          iat,
        },
      );
      expect(
        usersRepositoryMock.findOrCreateByExtUserIdAndEmail,
      ).toHaveBeenCalledWith(extUserId, email);
    });

    it('should use max expiration time when OIDC token has no exp', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const email = fakeEmailAddress();
      const accessToken = faker.string.alphanumeric(64);

      const maxExpiration = new Date(
        now.getTime() + maxValidityPeriodInSeconds * 1_000,
      );

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: true,
        exp: undefined,
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserIdAndEmail.mockResolvedValue(
        userId,
      );
      authRepositoryMock.signToken.mockReturnValue(accessToken);

      const result = await target.authenticateWithOidc(
        faker.string.alphanumeric(32),
      );

      expect(result).toEqual(expect.objectContaining({ accessToken }));
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.objectContaining({
          auth_method: AuthMethod.Oidc,
          sub: userId.toString(),
        }),
        {
          nbf: undefined,
          exp: maxExpiration,
          iat: new Date(),
        },
      );
      expect(
        usersRepositoryMock.findOrCreateByExtUserIdAndEmail,
      ).toHaveBeenCalledWith(extUserId, email);
    });

    it('should pass a verified email when finding or creating the user', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const email = fakeEmailAddress();

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: true,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserIdAndEmail.mockResolvedValue(
        userId,
      );
      authRepositoryMock.signToken.mockReturnValue('token');

      await target.authenticateWithOidc(faker.string.alphanumeric(32));

      expect(
        usersRepositoryMock.findOrCreateByExtUserIdAndEmail,
      ).toHaveBeenCalledWith(extUserId, email);
    });

    it('should throw UnauthorizedException when the email is not verified', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const email = fakeEmailAddress();

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: false,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(UnauthorizedException);

      expect(
        usersRepositoryMock.findOrCreateByExtUserIdAndEmail,
      ).not.toHaveBeenCalled();
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when email_verified is undefined', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const email = fakeEmailAddress();

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when the email claim is missing', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email_verified: true,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(UnauthorizedException);

      expect(
        usersRepositoryMock.findOrCreateByExtUserIdAndEmail,
      ).not.toHaveBeenCalled();
    });

    it('should propagate errors from finding or creating the user with email', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const email = fakeEmailAddress();
      const error = new Error('Database connection failed');

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: true,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserIdAndEmail.mockRejectedValue(
        error,
      );

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(error);

      expect(
        usersRepositoryMock.findOrCreateByExtUserIdAndEmail,
      ).toHaveBeenCalledWith(extUserId, email);
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when exp exceeds max', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const exp = new Date(
        now.getTime() + (maxValidityPeriodInSeconds + 60) * 1_000,
      );

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email: fakeEmailAddress(),
        email_verified: true,
        exp,
        nbf: undefined,
        iat: undefined,
      });

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(ForbiddenException);

      expect(
        usersRepositoryMock.findOrCreateByExtUserIdAndEmail,
      ).not.toHaveBeenCalled();
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should not throw when exp equals max validity', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const userId = faker.number.int();
      const email = fakeEmailAddress();
      const exp = new Date(now.getTime() + maxValidityPeriodInSeconds * 1_000);

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: true,
        exp,
        nbf: undefined,
        iat: undefined,
      });
      usersRepositoryMock.findOrCreateByExtUserIdAndEmail.mockResolvedValue(
        userId,
      );
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
        usersRepositoryMock.findOrCreateByExtUserIdAndEmail,
      ).not.toHaveBeenCalled();
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should propagate errors from findOrCreateByExtUserIdAndEmail', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const extUserId = `auth0|${faker.string.uuid()}`;
      const email = fakeEmailAddress();

      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: extUserId,
        email,
        email_verified: true,
        exp: new Date(now.getTime() + 3600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });
      const error = new Error('Database connection failed');
      usersRepositoryMock.findOrCreateByExtUserIdAndEmail.mockRejectedValue(
        error,
      );

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32)),
      ).rejects.toThrow(error);

      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });
  });

  describe('step-up authentication', () => {
    const arrange = (amr: Array<string> | undefined): void => {
      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue(
        auth0TokenBuilder().with('amr', amr).build(),
      );
      usersRepositoryMock.findOrCreateByExtUserIdAndEmail.mockResolvedValue(
        faker.number.int(),
      );
      authRepositoryMock.signToken.mockReturnValue(
        faker.string.alphanumeric(64),
      );
    };

    const expectStamp = (mfaVerifiedAt: number | undefined): void => {
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.objectContaining({ mfa_verified_at: mfaVerifiedAt }),
        expect.anything(),
      );
    };

    it('should stamp mfa_verified_at when the provider performed MFA', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      arrange(['pwd', 'mfa']);

      await target.authenticateWithOidc(faker.string.alphanumeric(32));

      expectStamp(Math.floor(now.getTime() / 1_000));
    });

    it('should stamp mfa_verified_at on a plain login, which is itself multi-factor', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      arrange(['mfa']);

      await target.authenticateWithOidc(faker.string.alphanumeric(32), false);

      expectStamp(Math.floor(now.getTime() / 1_000));
    });

    it('should not stamp mfa_verified_at when amr is absent', async () => {
      // Auth0 omits `amr` when an existing SSO session is reused without a
      // challenge, which must not count as a fresh second factor.
      arrange(undefined);

      await target.authenticateWithOidc(faker.string.alphanumeric(32));

      expectStamp(undefined);
    });

    it('should not stamp mfa_verified_at when amr lacks mfa', async () => {
      arrange(['pwd']);

      await target.authenticateWithOidc(faker.string.alphanumeric(32));

      expectStamp(undefined);
    });

    it('should reject an elevation callback whose token does not prove MFA', async () => {
      // Guards against the tenant silently ignoring acr_values because the
      // post-login Action is missing or misconfigured.
      arrange(['pwd']);

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32), true),
      ).rejects.toThrow(UnauthorizedException);
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should reject an elevation callback whose token has no amr at all', async () => {
      arrange(undefined);

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32), true),
      ).rejects.toThrow(UnauthorizedException);
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should accept an elevation callback whose token proves MFA', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      arrange(['mfa']);
      // A step-up needs a live session to elevate.
      authRepositoryMock.decodeToken.mockReturnValue({
        ...oidcAuthPayloadDtoBuilder().build(),
        exp: new Date(now.getTime() + 3_600 * 1_000),
        nbf: undefined,
        iat: undefined,
      });

      await expect(
        target.authenticateWithOidc(
          faker.string.alphanumeric(32),
          true,
          faker.string.alphanumeric(64),
        ),
      ).resolves.toEqual(
        expect.objectContaining({ accessToken: expect.any(String) }),
      );
    });
  });

  describe('session lifetime on step-up', () => {
    const arrange = (): void => {
      auth0RepositoryMock.authenticateWithAuthorizationCode.mockResolvedValue({
        sub: `auth0|${faker.string.uuid()}`,
        email: fakeEmailAddress(),
        email_verified: true,
        exp: undefined,
        nbf: undefined,
        iat: undefined,
        amr: ['mfa'],
      });
      usersRepositoryMock.findOrCreateByExtUserIdAndEmail.mockResolvedValue(
        faker.number.int(),
      );
      authRepositoryMock.signToken.mockReturnValue(
        faker.string.alphanumeric(64),
      );
    };

    // The session lifetime is an absolute timeout. A step-up proves only the
    // second factor, so it must not reset that clock.
    it('should keep the prior session expiry instead of extending the session', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      arrange();
      // Strictly inside the max-validity window, so the carry-over branch —
      // not the bound — decides the expiry.
      const remainingSeconds = faker.number.int({
        min: 60,
        max: maxValidityPeriodInSeconds - 60,
      });
      const priorExp = new Date(now.getTime() + remainingSeconds * 1_000);
      const priorAccessToken = faker.string.alphanumeric(64);
      authRepositoryMock.decodeToken.mockReturnValue({
        ...oidcAuthPayloadDtoBuilder().build(),
        exp: priorExp,
        nbf: undefined,
        iat: undefined,
      });

      const result = await target.authenticateWithOidc(
        faker.string.alphanumeric(32),
        true,
        priorAccessToken,
      );

      expect(authRepositoryMock.decodeToken).toHaveBeenCalledWith(
        priorAccessToken,
      );
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ exp: priorExp }),
      );
      expect(result.maxAge).toBe(remainingSeconds);
    });

    // The max-validity bound applies to the carried-over expiry too: a prior
    // token claiming more than the constant allows never propagates.
    it('should not carry over a prior expiry beyond the max-validity bound', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      arrange();
      const beyondMax = new Date(
        now.getTime() + (maxValidityPeriodInSeconds + 60) * 1_000,
      );
      authRepositoryMock.decodeToken.mockReturnValue({
        ...oidcAuthPayloadDtoBuilder().build(),
        exp: beyondMax,
        nbf: undefined,
        iat: undefined,
      });

      await target.authenticateWithOidc(
        faker.string.alphanumeric(32),
        true,
        faker.string.alphanumeric(64),
      );

      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          exp: new Date(now.getTime() + maxValidityPeriodInSeconds * 1_000),
        }),
      );
    });

    // A step-up elevates an existing session; without one — e.g. it expired
    // while the user was on the challenge page — there is nothing to elevate,
    // and minting a fresh session would let elevation double as a login.
    it('should reject the step-up when the prior session cannot be decoded', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      arrange();
      authRepositoryMock.decodeToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        target.authenticateWithOidc(
          faker.string.alphanumeric(32),
          true,
          faker.string.alphanumeric(64),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should reject the step-up when there is no prior session', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      arrange();

      await expect(
        target.authenticateWithOidc(faker.string.alphanumeric(32), true),
      ).rejects.toThrow(UnauthorizedException);

      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should ignore the prior session on a plain login', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      arrange();

      const result = await target.authenticateWithOidc(
        faker.string.alphanumeric(32),
        false,
        faker.string.alphanumeric(64),
      );

      expect(authRepositoryMock.decodeToken).not.toHaveBeenCalled();
      expect(result.maxAge).toBe(maxValidityPeriodInSeconds);
    });
  });

  describe('isElevationState', () => {
    it('should detect a step-up state', () => {
      auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(
        faker.internet.url(),
      );
      const { state } = target.createOidcAuthorizationRequest(undefined, {
        elevate: true,
      });

      expect(target.isElevationState(state)).toBe(true);
    });

    it('should not detect a step-up state on a plain login', () => {
      auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(
        faker.internet.url(),
      );
      const { state } = target.createOidcAuthorizationRequest();

      expect(target.isElevationState(state)).toBe(false);
    });

    it('should not detect a step-up state on an enrollment round-trip', () => {
      auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(
        faker.internet.url(),
      );
      const { state } = target.createOidcAuthorizationRequest(undefined, {
        enroll: true,
      });

      expect(target.isElevationState(state)).toBe(false);
    });

    it('should throw on a malformed state', () => {
      expect(() => target.isElevationState('not-a-state')).toThrow(
        UnauthorizedException,
      );
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
      expect(decoded.enroll).toBeUndefined();
      expect(decoded.elevate).toBeUndefined();
      expect(auth0RepositoryMock.getAuthorizationUrl).toHaveBeenCalledWith(
        result.state,
        { connection: undefined, enroll: undefined, elevate: undefined },
      );
    });

    it('should pass connection through to the repository', () => {
      const authorizationUrl = faker.internet.url();
      auth0RepositoryMock.getAuthorizationUrl.mockReturnValue(authorizationUrl);

      const result = target.createOidcAuthorizationRequest(undefined, {
        connection: 'google-oauth2',
      });

      expect(result.authorizationUrl).toBe(authorizationUrl);
      expect(auth0RepositoryMock.getAuthorizationUrl).toHaveBeenCalledWith(
        result.state,
        { connection: 'google-oauth2', enroll: undefined, elevate: undefined },
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
          loggingServiceMock,
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
          loggingServiceMock,
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
  describe('MFA switch', () => {
    const authPayload = new AuthPayload({
      auth_method: AuthMethod.Oidc,
      sub: faker.number.int().toString(),
    });
    const extUserId = `auth0|${faker.string.uuid()}`;
    const totpMethod = { id: `totp|${faker.string.uuid()}`, type: 'totp' };
    const recoveryMethod = {
      id: `recovery-code|${faker.string.uuid()}`,
      type: 'recovery-code',
    };

    beforeEach(() => {
      usersRepositoryMock.findOneOrFail.mockResolvedValue({
        extUserId,
      } as Awaited<ReturnType<IUsersRepository['findOneOrFail']>>);
    });

    describe('listAuthenticators', () => {
      it('should map the Auth0 authentication methods', async () => {
        auth0RepositoryMock.listUserAuthenticationMethods.mockResolvedValue([
          totpMethod,
          recoveryMethod,
        ]);

        await expect(target.listAuthenticators(authPayload)).resolves.toEqual([
          expect.objectContaining({ id: totpMethod.id, type: 'totp' }),
          expect.objectContaining({
            id: recoveryMethod.id,
            type: 'recovery-code',
          }),
        ]);
      });

      it('should reject users without a linked OIDC identity', async () => {
        usersRepositoryMock.findOneOrFail.mockResolvedValue({
          extUserId: null,
        } as Awaited<ReturnType<IUsersRepository['findOneOrFail']>>);

        await expect(target.listAuthenticators(authPayload)).rejects.toThrow(
          new UnauthorizedException('User is not linked to an OIDC identity'),
        );
      });
    });

    describe('cleanupSupersededAuthenticators', () => {
      it('should delete all TOTP enrollments except the newest', async () => {
        const oldMethod = {
          id: 'totp|old',
          type: 'totp',
          created_at: '2026-07-01T10:00:00.000Z',
        };
        const newMethod = {
          id: 'totp|new',
          type: 'totp',
          created_at: '2026-07-17T10:00:00.000Z',
        };
        auth0RepositoryMock.listUserAuthenticationMethods.mockResolvedValue([
          newMethod,
          oldMethod,
          recoveryMethod,
        ]);

        await target.cleanupSupersededAuthenticators(
          Number(authPayload.getUserId()),
        );

        expect(
          auth0RepositoryMock.deleteUserAuthenticationMethod,
        ).toHaveBeenCalledTimes(1);
        expect(
          auth0RepositoryMock.deleteUserAuthenticationMethod,
        ).toHaveBeenCalledWith(extUserId, oldMethod.id);
      });

      it('should not delete anything when a single TOTP enrollment exists', async () => {
        auth0RepositoryMock.listUserAuthenticationMethods.mockResolvedValue([
          totpMethod,
          recoveryMethod,
        ]);

        await target.cleanupSupersededAuthenticators(
          Number(authPayload.getUserId()),
        );

        expect(
          auth0RepositoryMock.deleteUserAuthenticationMethod,
        ).not.toHaveBeenCalled();
      });

      it('should abort cleanup when a TOTP created_at is missing', async () => {
        auth0RepositoryMock.listUserAuthenticationMethods.mockResolvedValue([
          {
            id: 'totp|dated',
            type: 'totp',
            created_at: '2026-07-01T10:00:00.000Z',
          },
          {
            id: 'totp|missing-created-at',
            type: 'totp',
          },
          recoveryMethod,
        ]);

        await expect(
          target.cleanupSupersededAuthenticators(
            Number(authPayload.getUserId()),
          ),
        ).rejects.toThrow(
          'Cannot clean up TOTP authentication methods without created_at',
        );
        expect(
          auth0RepositoryMock.deleteUserAuthenticationMethod,
        ).not.toHaveBeenCalled();
      });
    });
  });
});
