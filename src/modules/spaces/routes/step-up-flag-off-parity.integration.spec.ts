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
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import {
  GATED_ROUTES,
  type Route,
  UNGATED_ROUTES,
} from '@/modules/spaces/routes/__tests__/elevation-routes';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { ElevationGuard } from '@/routes/common/auth/elevation.guard';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

/**
 * The question this file answers: with `features.mfaStepUp` off, does anything
 * behave differently from a gateway that never had step-up deployed at all?
 *
 * `elevation.integration.spec.ts` asserts the weaker property — that no route
 * answers `403 elevation_required` with the flag off. That would still pass if
 * the guard turned a 201 into a 500, or if it rejected a session shape it
 * should not have seen; "no elevation rejection" is not "no change".
 *
 * So the assertion here is differential: every Workspace route, under every
 * session shape a real caller can present, must answer *identically* on two
 * gateways booted side by side —
 *
 *   - `flagOff`: the deployed article, `features.mfaStepUp` off;
 *   - `withoutStepUp`: the same build with `ElevationGuard` replaced by a
 *     pass-through, which is what the route pipeline looked like before the
 *     guard was added to those ten controllers.
 *
 * Statuses *and* error messages are compared, so a difference in which
 * rejection a caller gets is a failure even when both are 4xx. The session
 * shapes deliberately include one minted before `mfa_verified_at` existed:
 * during a rolling deploy every session in flight is that shape, and it is
 * also what a token from the outgoing instance looks like.
 */

const ROUTES: Array<Route> = [...GATED_ROUTES, ...UNGATED_ROUTES];

// Short enough that the "lapsed" stamp below is unambiguously outside it, and
// not the production default, so a guard hardcoding 30 minutes would not slip
// through.
const ELEVATION_WINDOW_SECONDS = 5 * 60;

type Gateway = {
  app: INestApplication<Server>;
  jwtService: IJwtService;
  adminUserId: number;
};

/** How the caller's session looked when it reached the gateway. */
type SessionShape = {
  name: string;
  cookie: (gateway: Gateway) => Array<string>;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1_000);

const oidcCookie = (
  gateway: Gateway,
  mfaVerifiedAt: number | undefined,
): Array<string> => [
  `access_token=${gateway.jwtService.sign(
    oidcAuthPayloadDtoBuilder()
      .with('sub', gateway.adminUserId.toString())
      .with('mfa_verified_at', mfaVerifiedAt)
      .build(),
  )}`,
];

const SESSION_SHAPES: Array<SessionShape> = [
  {
    // What every session in flight looks like during the deploy that ships
    // step-up, and what the outgoing instance keeps minting until it is gone.
    name: 'an OIDC session minted before step-up existed',
    cookie: (gateway) => oidcCookie(gateway, undefined),
  },
  {
    name: 'an OIDC session whose elevation window has lapsed',
    cookie: (gateway) =>
      oidcCookie(gateway, nowSeconds() - ELEVATION_WINDOW_SECONDS - 1),
  },
  {
    name: 'an OIDC session with a fresh second factor',
    cookie: (gateway) => oidcCookie(gateway, nowSeconds()),
  },
  {
    name: 'a SIWE session',
    cookie: (gateway) => [
      `access_token=${gateway.jwtService.sign(
        siweAuthPayloadDtoBuilder()
          .with('sub', gateway.adminUserId.toString())
          .build(),
      )}`,
    ],
  },
  {
    name: 'no session at all',
    cookie: () => [],
  },
];

async function startGateway({
  mfaStepUp,
  withoutStepUp = false,
}: {
  mfaStepUp: boolean;
  /** Replaces `ElevationGuard` with a pass-through, i.e. the pre-feature pipeline. */
  withoutStepUp?: boolean;
}): Promise<Gateway> {
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
    // Harness capacity, not part of what is compared: the matrix below stands
    // up one Workspace per comparison on each gateway, which is far more than
    // the per-user creation caps a real caller is held to. Both gateways get
    // the same values, so the comparison is unaffected.
    spaces: {
      ...defaultConfiguration.spaces,
      maxSpaceCreationsPerUser: 10_000,
      rateLimit: {
        creation: { max: 10_000, windowSeconds: 600 },
        addressBookUpsertion: { max: 10_000, windowSeconds: 600 },
        addressBookRequestCreation: { max: 10_000, windowSeconds: 600 },
      },
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
    guards: withoutStepUp
      ? [
          {
            originalGuard: ElevationGuard,
            testGuard: { canActivate: (): boolean => true },
          },
        ]
      : [],
  });

  const jwtService = moduleFixture.get<IJwtService>(IJwtService);
  const usersRepository = moduleFixture.get<IUsersRepository>(IUsersRepository);
  const app = await new TestAppProvider().provide(moduleFixture);
  await initTestApplication(app);

  const adminUserId = await usersRepository.findOrCreateByExtUserIdAndEmail(
    faker.string.uuid(),
    fakeEmailAddress(),
  );

  return { app, jwtService, adminUserId };
}

/**
 * A Workspace the caller administers, created fresh for each comparison: a
 * route matrix that shared one Workspace would delete it partway through and
 * compare 404s to 404s from then on.
 */
async function createSpace(gateway: Gateway): Promise<string> {
  const response = await request(gateway.app.getHttpServer())
    .post('/v1/spaces')
    .set('Cookie', oidcCookie(gateway, nowSeconds()))
    .send({ name: nameBuilder() })
    .expect(201);

  return response.body.uuid;
}

type Outcome = { status: number; message: unknown };

async function call(
  gateway: Gateway,
  route: Route,
  spaceId: string,
  cookie: Array<string>,
): Promise<Outcome> {
  const test = request(gateway.app.getHttpServer())
    [route.method](route.path(spaceId))
    .set('Cookie', cookie);
  const response = await (route.body ? test.send(route.body) : test);

  return { status: response.status, message: response.body?.message };
}

describe('Workspace routes with features.mfaStepUp off vs no step-up at all', () => {
  let flagOff: Gateway;
  let withoutStepUp: Gateway;

  beforeAll(async () => {
    vi.resetAllMocks();

    flagOff = await startGateway({ mfaStepUp: false });
    // The flag value is irrelevant to this one — its guard is gone — so it is
    // left on, to make clear that what is simulated is the guard's absence.
    withoutStepUp = await startGateway({
      mfaStepUp: true,
      withoutStepUp: true,
    });
  });

  afterAll(async () => {
    await flagOff.app.close();
    await withoutStepUp.app.close();
  });

  describe.each(ROUTES)('$name', (route) => {
    it.each(SESSION_SHAPES)(
      'should answer $name exactly as a gateway without step-up',
      async (shape) => {
        // Sequential, not concurrent: both gateways must see the same request
        // order, and a 429 or a socket reset from hammering one of them would
        // read as a parity difference.
        const flagOffSpaceId = await createSpace(flagOff);
        const withoutStepUpSpaceId = await createSpace(withoutStepUp);

        const withFlagOff = await call(
          flagOff,
          route,
          flagOffSpaceId,
          shape.cookie(flagOff),
        );
        const withoutGuard = await call(
          withoutStepUp,
          route,
          withoutStepUpSpaceId,
          shape.cookie(withoutStepUp),
        );

        expect(withFlagOff).toStrictEqual(withoutGuard);
      },
    );
  });

  // A token from a newer instance carries claims an older one has never seen —
  // `mfa_verified_at` was exactly such a claim on the deploy that shipped
  // step-up. Sessions must survive that in both directions, or a rolling
  // deploy logs users out for as long as it takes to converge.
  it('should accept a session carrying a claim it does not know', async () => {
    const spaceId = await createSpace(flagOff);
    const token = flagOff.jwtService.sign({
      ...oidcAuthPayloadDtoBuilder()
        .with('sub', flagOff.adminUserId.toString())
        .build(),
      [`${faker.word.noun()}_at`]: faker.number.int({ min: 1, max: 2_000 }),
    });

    const response = await request(flagOff.app.getHttpServer())
      .get(`/v1/spaces/${spaceId}`)
      .set('Cookie', [`access_token=${token}`])
      .expect(200);

    expect(response.body).toMatchObject({ uuid: spaceId });
  });
});
