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
 * The OIDC half of the `features.mfaStepUp` question, in two parts.
 *
 * **What the flag does not gate.** It gates enforcement — `ElevationGuard` —
 * and nothing else: the authorize/callback round-trip is identical in both
 * states. That is deliberate (a client only starts a step-up in answer to a
 * 403 `elevation_required`, which the flag suppresses) but it is not
 * self-evident, so every outcome below is compared across the two states
 * rather than merely checked in one. Half-gating the round-trip later — an
 * `?elevate=true` that stops asking for a challenge while the callback still
 * demands `amr` — would turn every step-up into `authentication_failed`, and
 * would fail here.
 *
 * **That logging in is untouched.** Sign-in is the flag-independent path every
 * user takes on every deploy, and the step-up work changed the token schema
 * (`amr`), the authorize query (`elevate`), and the claims minted
 * (`mfa_verified_at`). So the provider-token shapes a real tenant returns are
 * exercised with the flag off: any of them failing to log in is an outage the
 * flag cannot roll back.
 *
 * `../../../spaces/routes/step-up-flag-off-parity.integration.spec.ts` covers
 * the route side: that with the flag off the Workspace routes answer exactly
 * as they did before the guard existed.
 */

const MULTI_FACTOR_ACR =
  'http://schemas.openid.net/pape/policies/2007/06/multi-factor';

// A realistic clock: epoch 0 would make the `mfa_verified_at` stamp itself 0
// and hide whether it was written at all.
const NOW_MS = 1_764_000_000_000;
const NOW_SECONDS = Math.floor(NOW_MS / 1_000);

type SessionPayload = Record<string, unknown> | undefined;

/** The end of one authorize -> callback round-trip, as the browser sees it. */
type RoundTripResult = {
  /** The minted session's claims, or undefined when none was set. */
  payload: SessionPayload;
  /** The `error` parameter the gateway redirected back with, if any. */
  error: string | null;
};

/**
 * An id_token shape a real Auth0 tenant can return on a plain login. Each one
 * must sign the user in; the claim stamped from it is secondary.
 */
const LOGIN_TOKEN_SHAPES: Array<{
  name: string;
  claims: Record<string, unknown>;
  /** Whether the shape proves a challenge, i.e. whether it should be stamped. */
  stamped: boolean;
}> = [
  { name: 'no amr claim at all', claims: {}, stamped: false },
  { name: 'amr without mfa', claims: { amr: ['pwd'] }, stamped: false },
  { name: 'amr with mfa', claims: { amr: ['mfa'] }, stamped: true },
  {
    name: 'amr with mfa among other methods',
    claims: { amr: ['pwd', 'mfa', 'otp'] },
    stamped: true,
  },
  {
    name: 'an amr method the gateway has never heard of',
    claims: { amr: [faker.word.noun()] },
    stamped: false,
  },
  {
    name: 'claims the gateway does not model',
    claims: {
      amr: ['mfa'],
      acr: MULTI_FACTOR_ACR,
      auth_time: NOW_SECONDS,
      [`${faker.word.noun()}_claim`]: faker.word.words(),
    },
    stamped: true,
  },
];

/** What one gateway, in one flag state, does across every scenario. */
type StepUpOutcomes = {
  elevateAcrValues: string | null;
  plainAcrValues: string | null;
  /** Status of an authorize call carrying a parameter the gateway ignores. */
  unknownQueryParamStatus: number;
  /** Status of `?elevate=false` — a value the schema does not accept. */
  elevateFalseStatus: number;
  /** Status of `?enroll=true`, the pre-existing hosted-enrollment flow. */
  enrollStatus: number;
  /** Step-up whose provider token proves a challenge was passed. */
  challengedElevation: RoundTripResult;
  /** Step-up whose provider token proves no challenge happened. */
  unchallengedElevation: RoundTripResult;
  /** Step-up arriving with no live session cookie to elevate. */
  elevationWithoutSession: RoundTripResult;
  /** Plain logins, one per {@link LOGIN_TOKEN_SHAPES} entry, in order. */
  logins: Array<RoundTripResult>;
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
  claims: Record<string, unknown>,
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
      ...claims,
    },
  });
}

/**
 * Boots a gateway with step-up enforcement in the given state and drives every
 * scenario through it. Timers are faked for the run so that the
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

  const authorize = (query: string): request.Test =>
    request(app.getHttpServer()).get(`/v1/auth/oidc/authorize${query}`);

  const authorizeUrl = async (query: string): Promise<URL> => {
    const response = await authorize(query).expect(302);

    return new URL(response.headers.location);
  };

  const authorizeStatus = async (query: string): Promise<number> =>
    (await authorize(query)).status;

  /** Drives a full authorize -> callback round-trip. */
  const roundTrip = async (args: {
    elevate: boolean;
    claims: Record<string, unknown>;
    /** Whether the callback arrives with a live session cookie. */
    withPriorSession?: boolean;
  }): Promise<RoundTripResult> => {
    networkService.postForm.mockResolvedValueOnce({
      status: 200,
      data: rawify({
        access_token: faker.string.alphanumeric(64),
        id_token: signAuth0Token(auth0, args.claims),
        token_type: 'Bearer',
        scope: faker.lorem.words(),
      }),
    });

    const authorizeResponse = await authorize(
      args.elevate ? '?elevate=true' : '',
    ).expect(302);

    const state = new URL(authorizeResponse.headers.location).searchParams.get(
      'state',
    );
    const stateCookie = (
      authorizeResponse.headers['set-cookie'] as unknown as Array<string>
    )
      .find((cookie) => cookie.startsWith('auth_state='))
      ?.split(';')[0];

    const cookies = [stateCookie!];
    if (args.withPriorSession) {
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

    return {
      payload: accessToken
        ? jwtService.verify<Record<string, unknown>>(accessToken)
        : undefined,
      error: new URL(callbackResponse.headers.location).searchParams.get(
        'error',
      ),
    };
  };

  try {
    const logins: Array<RoundTripResult> = [];
    for (const shape of LOGIN_TOKEN_SHAPES) {
      logins.push(await roundTrip({ elevate: false, claims: shape.claims }));
    }

    return {
      elevateAcrValues: (await authorizeUrl('?elevate=true')).searchParams.get(
        'acr_values',
      ),
      plainAcrValues: (await authorizeUrl('')).searchParams.get('acr_values'),
      unknownQueryParamStatus: await authorizeStatus(
        `?${faker.word.noun()}=${faker.word.noun()}`,
      ),
      elevateFalseStatus: await authorizeStatus('?elevate=false'),
      enrollStatus: await authorizeStatus('?enroll=true'),
      challengedElevation: await roundTrip({
        elevate: true,
        claims: { amr: ['mfa'] },
        withPriorSession: true,
      }),
      unchallengedElevation: await roundTrip({
        elevate: true,
        claims: { amr: ['pwd'] },
        withPriorSession: true,
      }),
      elevationWithoutSession: await roundTrip({
        elevate: true,
        claims: { amr: ['mfa'] },
      }),
      logins,
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

  describe('signing in with the flag off', () => {
    it.each(LOGIN_TOKEN_SHAPES.map((shape, index) => ({ ...shape, index })))(
      'should sign the user in with $name',
      ({ index, stamped }) => {
        const login = disabled.logins[index];

        expect(login.error).toBeNull();
        expect(login.payload).toMatchObject({ auth_method: 'oidc' });
        expect(login.payload?.mfa_verified_at).toBe(
          stamped ? NOW_SECONDS : undefined,
        );
      },
    );

    it('should log in identically with the flag on', () => {
      expect(disabled.logins).toStrictEqual(enabled.logins);
    });

    it('should still ignore a query parameter it does not model', () => {
      expect(disabled.unknownQueryParamStatus).toBe(302);
      expect(disabled.enrollStatus).toBe(302);
    });

    // The one flag-independent rejection the step-up work introduced: `elevate`
    // is now a validated parameter, so a value other than `true` is a 422 even
    // with the flag off. Pinned rather than fixed: the clients only ever send
    // `elevate=true`, and only after a 403 the flag suppresses.
    it('should reject a non-true elevate value even with the flag off', () => {
      expect(disabled.elevateFalseStatus).toBe(422);
      expect(enabled.elevateFalseStatus).toBe(422);
    });
  });

  describe('the step-up round-trip, which the flag does not gate', () => {
    it('should request the multi-factor acr_values on elevation in both states', () => {
      expect(enabled.elevateAcrValues).toBe(MULTI_FACTOR_ACR);
      expect(disabled.elevateAcrValues).toBe(MULTI_FACTOR_ACR);
    });

    it('should not request acr_values on a plain login in either state', () => {
      expect(enabled.plainAcrValues).toBeNull();
      expect(disabled.plainAcrValues).toBeNull();
    });

    it('should elevate a challenged step-up in both states', () => {
      expect(enabled.challengedElevation.payload).toMatchObject({
        auth_method: 'oidc',
        mfa_verified_at: NOW_SECONDS,
      });
      expect(disabled.challengedElevation.payload).toMatchObject({
        auth_method: 'oidc',
        mfa_verified_at: NOW_SECONDS,
      });
    });

    // The callback proves the challenge from `amr` rather than trusting the
    // `acr_values` it asked for, and the flag must not weaken that: an
    // environment with the flag off is still minting sessions whose stamp the
    // guard will trust the moment the flag goes on.
    it('should refuse an unchallenged step-up in both states', () => {
      expect(enabled.unchallengedElevation.payload).toBeUndefined();
      expect(disabled.unchallengedElevation.payload).toBeUndefined();
    });

    // Asserted as an equality, not a value: whether a step-up arriving without
    // a live session mints one or is refused is a decision of the callback
    // (see the session-lifetime work in PR 3374), and either way the flag must
    // not be what decides it.
    it('should treat a step-up with no session to elevate the same in both states', () => {
      expect(disabled.elevationWithoutSession).toStrictEqual(
        enabled.elevationWithoutSession,
      );
    });

    // The session's lifetime is decided by the callback, which never reads the
    // flag: whatever the elevated session's expiry is, the flag must not be
    // what changes it. Asserted as an equality rather than a value so that it
    // keeps holding when the expiry itself changes.
    it('should give the elevated session the same lifetime in both states', () => {
      // Pinned as a number first: two undefined expiries would compare equal
      // and pass this on a callback that stopped setting one at all.
      expect(enabled.challengedElevation.payload?.exp).toEqual(
        expect.any(Number),
      );

      expect(enabled.challengedElevation.payload?.exp).toBe(
        disabled.challengedElevation.payload?.exp,
      );
    });
  });
});
