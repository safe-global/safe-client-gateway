// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { materializedSubscriptionBuilder } from '@/modules/entitlements/domain/entities/__tests__/materialized-subscription.builder';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';

/** Registers a user and the space they administer, as a client would. */
export async function createSpaceForSigner(args: {
  app: INestApplication;
  jwtService: IJwtService;
  postgresDatabaseService: PostgresDatabaseService;
}): Promise<{ accessToken: string; spaceUuid: string; spaceId: number }> {
  const { app, jwtService, postgresDatabaseService } = args;
  const walletResponse = await request(app.getHttpServer())
    .post('/v1/users/wallet')
    .set('Cookie', [
      `access_token=${jwtService.sign(siweAuthPayloadDtoBuilder().build())}`,
    ])
    .expect(201);
  const accessToken = jwtService.sign(
    siweAuthPayloadDtoBuilder()
      .with('sub', String(walletResponse.body.id))
      .build(),
  );
  const spaceResponse = await request(app.getHttpServer())
    .post('/v1/spaces')
    .set('Cookie', [`access_token=${accessToken}`])
    .send({ name: nameBuilder() })
    .expect(201);

  const spaceRepository = await postgresDatabaseService.getRepository(Space);
  const space = await spaceRepository.findOneOrFail({
    where: { uuid: spaceResponse.body.uuid },
    select: { id: true },
  });

  return {
    accessToken,
    spaceUuid: spaceResponse.body.uuid,
    spaceId: space.id,
  };
}

export function safePayload(
  count: number,
): Array<{ chainId: string; address: `0x${string}` }> {
  return faker.helpers.multiple(
    () => ({
      chainId: '1',
      address: getAddress(faker.finance.ethereumAddress()),
    }),
    { count },
  );
}

/** POSTs Safes to a Space, as a client would; the caller asserts the response. */
export async function addSafes(args: {
  app: INestApplication;
  spaceUuid: string;
  accessToken: string;
  safes: Array<{ chainId: string; address: `0x${string}` }>;
}): Promise<request.Response> {
  return await request(args.app.getHttpServer())
    .post(`/v1/spaces/${args.spaceUuid}/safes`)
    .set('Cookie', [`access_token=${args.accessToken}`])
    .send({ safes: args.safes });
}

/** Grants feature entitlements in one call — a second call drops the first. */
export async function grantEntitlements(args: {
  entitlementsService: EntitlementsService;
  spaceId: number;
  entitlements: Array<{ featureKey: FeatureKey; quota: number | null }>;
}): Promise<void> {
  await args.entitlementsService.materializeFromEvent({
    spaceId: args.spaceId,
    subscription: materializedSubscriptionBuilder()
      .with('status', 'active')
      .with(
        'entitlements',
        args.entitlements.map((entitlement) => ({
          featureKey: entitlement.featureKey,
          enabled: true,
          quota: entitlement.quota,
          value: null,
        })),
      )
      .build(),
    eventAt: new Date(),
  });
}
