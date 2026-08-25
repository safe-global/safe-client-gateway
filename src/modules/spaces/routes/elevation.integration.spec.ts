// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { ELEVATION_REQUIRED_ERROR } from '@/routes/common/auth/elevation.guard';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

// Deliberately not the production default (30 minutes), so that a guard which
// ignored configuration and hardcoded the default would fail these tests.
const ELEVATION_WINDOW_SECONDS = 5 * 60;

type Method = 'post' | 'put' | 'patch' | 'delete' | 'get';

type Route = {
  name: string;
  method: Method;
  path: (spaceId: string) => string;
  body?: object;
};

/**
 * Every route that requires a fresh second factor, per Milestone 2 of the
 * Workspace 2FA plan.
 *
 * The line is drawn at what a stolen session could do to *other people*:
 * changing who has access to the Workspace, or changing state the whole
 * Workspace shares. Acting only on your own membership is not gated — see
 * {@link UNGATED_ROUTES}.
 *
 * Guards run before validation pipes, so the request bodies here only need to
 * exist — the assertions are about the elevation contract, not about each
 * route's own success path, which its own controller spec covers.
 */
const GATED_ROUTES: Array<Route> = [
  {
    name: 'POST /v1/spaces/:spaceId/members/invite',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/members/invite`,
    body: { users: [] },
  },
  {
    name: 'PATCH /v1/spaces/:spaceId/members/:userId/role',
    method: 'patch',
    path: (id) => `/v1/spaces/${id}/members/1/role`,
    body: { role: 'MEMBER' },
  },
  {
    name: 'DELETE /v1/spaces/:spaceId/members/:userId',
    method: 'delete',
    path: (id) => `/v1/spaces/${id}/members/1`,
  },
  {
    name: 'PATCH /v1/spaces/:id',
    method: 'patch',
    path: (id) => `/v1/spaces/${id}`,
    body: { name: nameBuilder() },
  },
  {
    name: 'DELETE /v1/spaces/:id',
    method: 'delete',
    path: (id) => `/v1/spaces/${id}`,
  },
  {
    name: 'POST /v1/spaces/:spaceId/safes',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/safes`,
    body: { safes: [] },
  },
  {
    name: 'DELETE /v1/spaces/:spaceId/safes',
    method: 'delete',
    path: (id) => `/v1/spaces/${id}/safes`,
    body: { safes: [] },
  },
  {
    name: 'PUT /v1/spaces/:spaceId/address-book',
    method: 'put',
    path: (id) => `/v1/spaces/${id}/address-book`,
    body: { items: [] },
  },
  {
    name: 'DELETE /v1/spaces/:spaceId/address-book/:address',
    method: 'delete',
    path: (id) =>
      `/v1/spaces/${id}/address-book/${getAddress(faker.finance.ethereumAddress())}`,
  },
  {
    name: 'PUT /v1/spaces/:spaceId/address-book/requests/:requestId/approve',
    method: 'put',
    path: (id) => `/v1/spaces/${id}/address-book/requests/1/approve`,
  },
];

/**
 * Routes deliberately left ungated. Pinned here so that gating or un-gating a
 * Workspace route is always a conscious edit to this list, never a silent
 * side effect of touching a controller.
 *
 * Most of these only read, or only change the caller's own membership: an
 * attacker holding a stolen session gains nothing from them that the session
 * did not already grant, so a challenge would cost every legitimate user a
 * prompt to buy nothing. The entries where that reasoning does not apply
 * carry their own justification below.
 */
const UNGATED_ROUTES: Array<Route> = [
  // Creating a Workspace has no prior state to tamper with — the caller is the
  // only member of what they just made — and gating it would put a challenge
  // in the middle of onboarding. Listed rather than omitted so that gating it
  // later is a deliberate edit, like every other row here.
  {
    name: 'POST /v1/spaces',
    method: 'post',
    path: () => '/v1/spaces',
    body: { name: nameBuilder() },
  },
  {
    name: 'GET /v1/spaces/:id',
    method: 'get',
    path: (id) => `/v1/spaces/${id}`,
  },
  {
    name: 'GET /v1/spaces/:spaceId/members',
    method: 'get',
    path: (id) => `/v1/spaces/${id}/members`,
  },
  {
    name: 'GET /v1/spaces/:spaceId/safes',
    method: 'get',
    path: (id) => `/v1/spaces/${id}/safes`,
  },
  {
    name: 'GET /v1/spaces/:spaceId/address-book',
    method: 'get',
    path: (id) => `/v1/spaces/${id}/address-book`,
  },
  {
    name: 'GET /v1/spaces/:spaceId/address-book/requests',
    method: 'get',
    path: (id) => `/v1/spaces/${id}/address-book/requests`,
  },
  {
    name: 'PATCH /v1/spaces/:spaceId/members/alias',
    method: 'patch',
    path: (id) => `/v1/spaces/${id}/members/alias`,
    body: { alias: nameBuilder() },
  },
  // Responding to an invitation someone else already sent, and leaving of
  // your own accord, only move the caller in or out of the Workspace. The
  // invite itself is gated, which is where the access decision is made.
  {
    name: 'POST /v1/spaces/:spaceId/members/accept',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/members/accept`,
    body: {},
  },
  {
    name: 'POST /v1/spaces/:spaceId/members/decline',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/members/decline`,
    body: {},
  },
  {
    name: 'DELETE /v1/spaces/:spaceId/members (self-removal)',
    method: 'delete',
    path: (id) => `/v1/spaces/${id}/members`,
  },
  // The one admin action on another user here. It re-sends an invitation a
  // gated `members/invite` call already created: it grants no access, changes
  // no role, and cannot reach anyone who was not already invited. The worst an
  // attacker gets is repeat mail to an address an admin already chose to
  // invite, so the cost of a challenge outweighs it.
  {
    name: 'POST /v1/spaces/:spaceId/members/:userId/invite/renew',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/members/1/invite/renew`,
  },
  {
    name: 'POST /v1/spaces/:spaceId/address-book/requests (propose contact)',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/address-book/requests`,
    body: {},
  },
  {
    name: 'PUT /v1/spaces/:spaceId/address-book/requests/:requestId/reject',
    method: 'put',
    path: (id) => `/v1/spaces/${id}/address-book/requests/1/reject`,
  },
];

type ElevationTestContext = {
  app: INestApplication<Server>;
  jwtService: IJwtService;
  spaceId: string;
  adminUserId: number;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1_000);

const oidcToken = (
  context: Pick<ElevationTestContext, 'jwtService' | 'adminUserId'>,
  mfaVerifiedAt: number | undefined,
): string =>
  context.jwtService.sign(
    oidcAuthPayloadDtoBuilder()
      .with('sub', context.adminUserId.toString())
      .with('mfa_verified_at', mfaVerifiedAt)
      .build(),
  );

const siweToken = (
  context: Pick<ElevationTestContext, 'jwtService' | 'adminUserId'>,
): string =>
  context.jwtService.sign(
    siweAuthPayloadDtoBuilder()
      .with('sub', context.adminUserId.toString())
      .build(),
  );

const send = (
  context: ElevationTestContext,
  route: Route,
  accessToken: string,
): request.Test | Promise<request.Response> => {
  const test = request(context.app.getHttpServer())
    [route.method](route.path(context.spaceId))
    .set('Cookie', [`access_token=${accessToken}`]);

  return route.body ? test.send(route.body) : test;
};

const isElevationRejection = (response: request.Response): boolean =>
  response.status === 403 &&
  response.body?.message === ELEVATION_REQUIRED_ERROR;

/**
 * Boots the gateway with step-up enforcement in the given state, and creates
 * the Workspace the route matrices below act on.
 *
 * `features.mfaStepUp` is read once, in `ElevationGuard`'s constructor, so
 * each state needs an application of its own: flipping configuration between
 * tests would leave the guard on whichever value it was built with.
 */
async function startGateway(mfaStepUp: boolean): Promise<ElevationTestContext> {
  const defaultConfiguration = configuration();

  const testConfiguration = (): typeof defaultConfiguration => ({
    ...defaultConfiguration,
    auth: {
      ...defaultConfiguration.auth,
      elevationWindowSeconds: ELEVATION_WINDOW_SECONDS,
    },
    features: {
      ...defaultConfiguration.features,
      auth: true,
      users: true,
      mfaStepUp,
    },
  });

  const moduleFixture = await createTestModule({
    config: testConfiguration,
    overridePostgresV2: false,
    modules: [
      {
        originalModule: NotificationsRepositoryV2Module,
        testModule: TestNotificationsRepositoryV2Module,
      },
    ],
  });

  const jwtService = moduleFixture.get<IJwtService>(IJwtService);
  const usersRepository = moduleFixture.get<IUsersRepository>(IUsersRepository);
  const app = await new TestAppProvider().provide(moduleFixture);
  await initTestApplication(app);

  const adminUserId = await usersRepository.findOrCreateByExtUserIdAndEmail(
    faker.string.uuid(),
    fakeEmailAddress(),
  );

  // Space creation is deliberately ungated, so an elevated token is not
  // required to build the fixture.
  const response = await request(app.getHttpServer())
    .post('/v1/spaces')
    .set('Cookie', [
      `access_token=${oidcToken({ jwtService, adminUserId }, nowSeconds())}`,
    ])
    .send({ name: nameBuilder() })
    .expect(201);

  return { app, jwtService, spaceId: response.body.uuid, adminUserId };
}

describe('Workspace step-up elevation (ElevationGuard)', () => {
  let context: ElevationTestContext;

  beforeAll(async () => {
    vi.resetAllMocks();

    // Explicitly on rather than inherited: with the flag off the guard admits
    // everything, and every assertion below would pass vacuously.
    context = await startGateway(true);
  });

  afterAll(async () => {
    await context.app.close();
  });

  describe.each(GATED_ROUTES)('$name', (route) => {
    it('should reject an OIDC session that never presented a second factor', async () => {
      const response = await send(
        context,
        route,
        oidcToken(context, undefined),
      );

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(ELEVATION_REQUIRED_ERROR);
    });

    it('should reject an OIDC session whose elevation window has expired', async () => {
      const response = await send(
        context,
        route,
        oidcToken(context, nowSeconds() - ELEVATION_WINDOW_SECONDS - 1),
      );

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(ELEVATION_REQUIRED_ERROR);
    });

    it('should not reject an OIDC session with a fresh second factor', async () => {
      const response = await send(
        context,
        route,
        oidcToken(context, nowSeconds()),
      );

      expect(isElevationRejection(response)).toBe(false);
    });

    it('should not reject a SIWE session, which is exempt until M3', async () => {
      const response = await send(context, route, siweToken(context));

      expect(isElevationRejection(response)).toBe(false);
    });

    it('should still require authentication', async () => {
      const response = await request(context.app.getHttpServer())[route.method](
        route.path(context.spaceId),
      );

      expect(response.status).toBe(403);
      expect(response.body.message).not.toBe(ELEVATION_REQUIRED_ERROR);
    });
  });

  describe.each(UNGATED_ROUTES)('$name', (route) => {
    it('should not require elevation', async () => {
      const response = await send(
        context,
        route,
        oidcToken(context, undefined),
      );

      expect(isElevationRejection(response)).toBe(false);
    });
  });
});

/**
 * The other half of the flag's contract: with `features.mfaStepUp` off the
 * gateway must behave exactly as it did before step-up existed, so that an
 * environment whose clients cannot yet turn a 403 `elevation_required` into a
 * step-up round-trip can be rolled back by flipping the flag, with no revert.
 *
 * The suite above proves the flag on; this one proves it off, over the same
 * gated matrix — an enforcement path that ignored the flag would only show up
 * here.
 */
describe('Workspace step-up elevation with features.mfaStepUp off', () => {
  let context: ElevationTestContext;

  beforeAll(async () => {
    vi.resetAllMocks();

    context = await startGateway(false);
  });

  afterAll(async () => {
    await context.app.close();
  });

  describe.each(GATED_ROUTES)('$name', (route) => {
    it('should admit an OIDC session that never presented a second factor', async () => {
      const response = await send(
        context,
        route,
        oidcToken(context, undefined),
      );

      expect(isElevationRejection(response)).toBe(false);
    });

    it('should admit an OIDC session whose elevation window has expired', async () => {
      const response = await send(
        context,
        route,
        oidcToken(context, nowSeconds() - ELEVATION_WINDOW_SECONDS - 1),
      );

      expect(isElevationRejection(response)).toBe(false);
    });

    it('should admit a SIWE session', async () => {
      const response = await send(context, route, siweToken(context));

      expect(isElevationRejection(response)).toBe(false);
    });

    // The flag turns off the second factor, not the first one: a route that
    // fell open to anonymous callers when it was flipped would be a far worse
    // regression than the one the flag exists to avoid.
    it('should still require authentication', async () => {
      const response = await request(context.app.getHttpServer())[route.method](
        route.path(context.spaceId),
      );

      expect(response.status).toBe(403);
      expect(response.body.message).not.toBe(ELEVATION_REQUIRED_ERROR);
    });
  });
});
