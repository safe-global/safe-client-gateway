// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { UUID_REGEX } from '@/domain/common/constants';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import type { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { EntitlementGuard } from '@/modules/entitlements/routes/guards/entitlement.guard';
import { SpaceIdParamSchema } from '@/modules/entitlements/routes/guards/space-id-param.schema';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { AUTH_PAYLOAD_REQUEST_PROPERTY } from '@/routes/common/auth/auth-payload.request';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

describe('EntitlementGuard', () => {
  const spaceUuid = fakeUuid();
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const userId = faker.number.int({ min: 1, max: 100_000 });
  let entitlementEnforcement: MockedObject<IEntitlementEnforcement>;
  let spacesRepository: MockedObject<Pick<ISpacesRepository, 'findIdByUuid'>>;
  let membersRepository: MockedObject<Pick<IMembersRepository, 'findOne'>>;
  let target: EntitlementGuard;

  /** The base is only reachable through a per-feature subclass. */
  class TestEntitlementGuard extends EntitlementGuard {
    public constructor(
      enforcement: IEntitlementEnforcement,
      spaces: ISpacesRepository,
      members: IMembersRepository,
    ) {
      super(enforcement, spaces, members, 'safe_seats');
    }
  }

  /** A request as `AuthGuard` leaves it: the verified session payload attached. */
  function context(params: unknown, authenticated = true): ExecutionContext {
    const request: Record<string, unknown> = { params };
    if (authenticated) {
      request[AUTH_PAYLOAD_REQUEST_PROPERTY] = siweAuthPayloadDtoBuilder()
        .with('sub', String(userId))
        .build();
    }
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    entitlementEnforcement = {
      assertWithinQuota: vi.fn(),
      prepareQuotaCheck: vi.fn(),
    };
    spacesRepository = { findIdByUuid: vi.fn().mockResolvedValue(spaceId) };
    membersRepository = {
      findOne: vi.fn().mockResolvedValue({ id: userId } as Member),
    };
    target = new TestEntitlementGuard(
      entitlementEnforcement,
      spacesRepository as MockedObject<ISpacesRepository>,
      membersRepository as MockedObject<IMembersRepository>,
    );
  });

  it('admits a space within its limit, asking about the feature it gates', async () => {
    await expect(
      target.canActivate(context({ spaceId: spaceUuid })),
    ).resolves.toBe(true);

    expect(spacesRepository.findIdByUuid).toHaveBeenCalledExactlyOnceWith(
      spaceUuid,
    );
    expect(
      entitlementEnforcement.assertWithinQuota,
    ).toHaveBeenCalledExactlyOnceWith({
      spaceId,
      featureKey: 'safe_seats',
      // Unvalidated payload here: it can only ask about the current limit.
      delta: 0,
    });
  });

  it('rejects a non-member before revealing anything about the entitlement', async () => {
    membersRepository.findOne.mockResolvedValue(null);

    await expect(
      target.canActivate(context({ spaceId: spaceUuid })),
    ).rejects.toThrow(ForbiddenException);

    expect(entitlementEnforcement.assertWithinQuota).not.toHaveBeenCalled();
  });

  it('rejects a space at or over its limit', async () => {
    const quota = faker.number.int({ min: 5, max: 10 });
    const quotaExceeded = new QuotaExceededError({
      feature: 'safe_seats',
      quota,
      used: quota,
      resetsAt: null,
    });
    entitlementEnforcement.assertWithinQuota.mockRejectedValue(quotaExceeded);

    await expect(
      target.canActivate(context({ spaceId: spaceUuid })),
    ).rejects.toThrow(quotaExceeded);
  });

  it('gates any id `SpaceIdPipe` would accept, not only an RFC-shaped one', async () => {
    // Passes UUID_REGEX but not a strict RFC check; the pipe resolves it.
    const laxUuid = '11111111-1111-0111-c111-111111111111';

    await expect(
      target.canActivate(context({ spaceId: laxUuid })),
    ).resolves.toBe(true);

    expect(spacesRepository.findIdByUuid).toHaveBeenCalledExactlyOnceWith(
      laxUuid,
    );
  });

  it('accepts exactly what `SpaceIdPipe` accepts', () => {
    // The guard skipping an id the pipe resolves would leave the handler
    // ungated, so both must gate on the same predicate.
    const ids = [
      fakeUuid(),
      '11111111-1111-0111-c111-111111111111',
      faker.lorem.slug(),
      '',
    ];

    for (const id of ids) {
      const { spaceId } = SpaceIdParamSchema.parse({ spaceId: id });
      expect(spaceId !== undefined).toBe(UUID_REGEX.test(id));
    }
  });

  it.each([
    ['no spaceId', {}],
    ['a malformed spaceId', { spaceId: faker.lorem.slug() }],
    ['no params at all', undefined],
  ])('does not gate a request with %s', async (_label, params) => {
    await expect(target.canActivate(context(params))).resolves.toBe(true);

    expect(spacesRepository.findIdByUuid).not.toHaveBeenCalled();
    expect(entitlementEnforcement.assertWithinQuota).not.toHaveBeenCalled();
  });
});
