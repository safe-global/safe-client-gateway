// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { oidcAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import {
  getAuth0JwksFixture,
  mockAuth0Jwks,
  signAuth0Jwt,
} from '@/modules/auth/oidc/auth0/__tests__/auth0-jwks.helper';
import { TestEmailApiModule } from '@/modules/email/pushwoosh/__tests__/test.email-api.module';
import { EmailModule } from '@/modules/email/pushwoosh/pushwoosh-email.module';
import { TestUsersModule } from '@/modules/users/__tests__/test.users.module';
import { UsersRepositoryModule } from '@/modules/users/domain/users-repository.module';
import { UsersModule } from '@/modules/users/users.module';
import { rawify } from '@/validation/entities/raw.entity';

/**
 * What `features.mfaStepUp` does *not* cover.
 *
 * The flag gates enforcement — `ElevationGuard` — and nothing else: the
 * step-up round-trip itself stays reachable in both states. That is
 * deliberate, and it is safe only because a client starts a step-up in
 * response to a 403 `elevation_required` that the flag prevents in the first
 * place. It is also fragile: gating half the round-trip (an `?elevate=true`
 * that stops requesting a challenge, say, while the callback still demands
 * `amr`) would turn every step-up into `authentication_failed`, so the two
 * states are asserted to be indistinguishable rather than merely working.
 *
 * `elevation.integration.spec.ts` covers the half of the contract this file
 * does not: what the flag *does* gate, over the whole Workspace route matrix.
 */

const MULTI_FACTOR_ACR =
  'http://schemas.openid.net/pape/policies/2007/06/multi-factor';

// A realistic clock: epoch 0 would make the `mfa_verified_at` stamp itself 0
// and hide whether it was written at all.
const NOW_MS = 1_764_000_000_000;
const NOW_SECONDS = Math.floor(NOW_MS / 1_000);

type SessionPayload = Record<string, unknown> | undefined;

/** What one gateway, in one flag state, does across the step-up scenarios. */
type StepUpOutcomes = {
  elevateAcrValues: string | null;
  plainAcrValues: string | null;
  /** Step-up whose provider token proves a challenge was passed. */
  challengedElevation: SessionPayload;
  /** Step-up whose provider token proves no challenge happened. */
  unchallengedElevation: SessionPayload;
  /** Plain login, which is itself multi-factor. */
  plainLogin: SessionPayload;
};

// One configuration object for both gateways, so that the randomised values
// in the test configuration (the session's max validity among them) cannot
// differ between the two flag states and be mistaken for the flag's doing.
const baseConfiguration = configuration();
const auth0Jwks = getAuth0JwksFixture();

/** The provider identity the gateway under test was configured with. */
type Auth0Identity = { issuer: string; audience: string };

function signAuth0Token(
  auth0: Auth0Identity,
  amr: Array<string> | undefined,
): string {
  return signAuth0Jwt({
    issuer: auth0.issuer,
    audience: auth0.audience,
    kid: auth0Jwks.kid,
    privateKey: auth0Jwks.privateKey,
    payload: {
      sub: faker.string.uuid(),
      email: faker.internet.email(),
      email_verified: true,
      iat: NOW_SECONDS,
      amr,
    },
  });
}

/**
 * Boots a gateway with step-up enforcement in the given state and drives every
 * step-up scenario through it. Timers are faked for the run so that the
 * `mfa_verified_at` stamps of the two gateways are comparable, and handed back
 * before the application is closed.
 */
async function collectOutcomes(mfaStepUp: boolean): Promise<StepUpOutcomes> {
  vi.useFakeTimers();
  const fetchMock = vi.spyOn(global, 'fetch');

  const testConfiguration = (): typeof baseConfiguration => ({
    ...baseConfiguration,
    features: {
      ...baseConfiguration.features,
      oidc_auth: true,
      mfaStepUp,
    },
  });

  const moduleFixture = await createTestModule({
    config: testConfiguration,
    modules: [
      {
        originalModule: EmailModule,
        testModule: TestEmailApiModule,
      },
      // Both modules are overridden with the same TestUsersModule: it mocks
      // IUsersRepository, which UsersRepositoryModule exports (consumed by
      // OidcAuthService) and which UsersModule re-exports.
      {
        originalModule: UsersModule,
        testModule: TestUsersModule,
      },
      {
        originalModule: UsersRepositoryModule,
        testModule: TestUsersModule,
      },
    ],
  });

  const networkService = moduleFixture.get(NetworkService);
  const jwtService = moduleFixture.get<IJwtService>(IJwtService);
  const configurationService = moduleFixture.get<IConfigurationService>(
    IConfigurationService,
  );
  const auth0: Auth0Identity = {
    issuer: `https://${configurationService.getOrThrow<string>('auth.auth0.domain')}/`,
    audience: configurationService.getOrThrow<string>('auth.auth0.clientId'),
  };
  const maxValidityPeriodSeconds = configurationService.getOrThrow<number>(
    'auth.maxValidityPeriodSeconds',
  );
  const app: INestApplication<Server> = await new TestAppProvider().provide(
    moduleFixture,
  );
  await initTestApplication(app);

  vi.setSystemTime(NOW_MS);
  mockAuth0Jwks({
    fetchMock,
    issuer: auth0.issuer,
    publicJwk: auth0Jwks.publicJwk,
    kid: auth0Jwks.kid,
  });

  /**
   * A session that is still alive when the challenge completes, as the client
   * elevating one always has. Its expiry sits inside the configured max
   * validity, which the test configuration randomises per run.
   */
  const priorSession = (): string =>
    jwtService.sign({
      ...oidcAuthPayloadDtoBuilder().build(),
      exp: new Date(
        NOW_MS + Math.max(1, Math.floor(maxValidityPeriodSeconds / 2)) * 1_000,
      ),
    });

  const authorizeUrl = async (elevate: boolean): Promise<URL> => {
    const response = await request(app.getHttpServer())
      .get(`/v1/auth/oidc/authorize${elevate ? '?elevate=true' : ''}`)
      .expect(302);

    return new URL(response.headers.location);
  };

  /** Drives a full authorize -> callback round-trip. */
  const roundTrip = async (args: {
    elevate: boolean;
    amr: Array<string> | undefined;
  }): Promise<SessionPayload> => {
    networkService.postForm.mockResolvedValueOnce({
      status: 200,
      data: rawify({
        access_token: faker.string.alphanumeric(64),
        id_token: signAuth0Token(auth0, args.amr),
        token_type: 'Bearer',
        scope: faker.lorem.words(),
      }),
    });

    const authorizeResponse = await request(app.getHttpServer())
      .get(`/v1/auth/oidc/authorize${args.elevate ? '?elevate=true' : ''}`)
      .expect(302);

    const state = new URL(authorizeResponse.headers.location).searchParams.get(
      'state',
    );
    const stateCookie = (
      authorizeResponse.headers['set-cookie'] as unknown as Array<string>
    )
      .find((cookie) => cookie.startsWith('auth_state='))
      ?.split(';')[0];

    const cookies = [stateCookie!];
    if (args.elevate) {
      cookies.push(`access_token=${priorSession()}`);
    }

    const callbackResponse = await request(app.getHttpServer())
      .get('/v1/auth/oidc/callback')
      .set('Cookie', cookies)
      .query({ code: faker.string.alphanumeric(32), state })
      .expect(302);

    const accessToken = (
      callbackResponse.headers['set-cookie'] as unknown as Array<string>
    )
      ?.find((cookie) => cookie.startsWith('access_token='))
      ?.match(/^access_token=([^;]+)/)?.[1];

    return accessToken
      ? jwtService.verify<Record<string, unknown>>(accessToken)
      : undefined;
  };

  try {
    return {
      elevateAcrValues: (await authorizeUrl(true)).searchParams.get(
        'acr_values',
      ),
      plainAcrValues: (await authorizeUrl(false)).searchParams.get(
        'acr_values',
      ),
      challengedElevation: await roundTrip({ elevate: true, amr: ['mfa'] }),
      unchallengedElevation: await roundTrip({ elevate: true, amr: ['pwd'] }),
      plainLogin: await roundTrip({ elevate: false, amr: ['mfa'] }),
    };
  } finally {
    vi.useRealTimers();
    await app.close();
    fetchMock.mockRestore();
  }
}

describe('OIDC step-up round-trip vs features.mfaStepUp', () => {
  let enabled: StepUpOutcomes;
  let disabled: StepUpOutcomes;

  beforeAll(async () => {
    enabled = await collectOutcomes(true);
    disabled = await collectOutcomes(false);
  });

  afterAll(() => {
    // `collectOutcomes` already hands the timers back; a safety net for a run
    // that threw between faking them and its own restore.
    vi.useRealTimers();
  });

  it('should request the multi-factor acr_values on elevation in both states', () => {
    expect(enabled.elevateAcrValues).toBe(MULTI_FACTOR_ACR);
    expect(disabled.elevateAcrValues).toBe(MULTI_FACTOR_ACR);
  });

  it('should not request acr_values on a plain login in either state', () => {
    expect(enabled.plainAcrValues).toBeNull();
    expect(disabled.plainAcrValues).toBeNull();
  });

  it('should elevate a challenged step-up in both states', () => {
    expect(enabled.challengedElevation).toMatchObject({
      auth_method: 'oidc',
      mfa_verified_at: NOW_SECONDS,
    });
    expect(disabled.challengedElevation).toMatchObject({
      auth_method: 'oidc',
      mfa_verified_at: NOW_SECONDS,
    });
  });

  // The callback proves the challenge from `amr` rather than trusting the
  // `acr_values` it asked for, and the flag must not weaken that: an
  // environment with the flag off is still minting sessions whose stamp the
  // guard will trust the moment the flag goes on.
  it('should refuse an unchallenged step-up in both states', () => {
    expect(enabled.unchallengedElevation).toBeUndefined();
    expect(disabled.unchallengedElevation).toBeUndefined();
  });

  it('should stamp a plain login that performed MFA in both states', () => {
    expect(enabled.plainLogin).toMatchObject({ mfa_verified_at: NOW_SECONDS });
    expect(disabled.plainLogin).toMatchObject({ mfa_verified_at: NOW_SECONDS });
  });

  // The session's lifetime is decided by the callback, which never reads the
  // flag: whatever the elevated session's expiry is, the flag must not be
  // what changes it. Asserted as an equality rather than a value so that it
  // keeps holding when the expiry itself changes.
  it('should give the elevated session the same lifetime in both states', () => {
    // Pinned as a number first: two undefined expiries would compare equal and
    // pass this on a callback that stopped setting one at all.
    expect(enabled.challengedElevation?.exp).toEqual(expect.any(Number));
    expect(enabled.plainLogin?.exp).toEqual(expect.any(Number));

    expect(enabled.challengedElevation?.exp).toBe(
      disabled.challengedElevation?.exp,
    );
    expect(enabled.plainLogin?.exp).toBe(disabled.plainLogin?.exp);
  });
});
