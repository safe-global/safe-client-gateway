// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ExecutionContext } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import type { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { EntitlementGuard } from '@/modules/entitlements/routes/guards/entitlement.guard';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

describe('EntitlementGuard', () => {
  const spaceUuid = fakeUuid();
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  let entitlementEnforcement: MockedObject<IEntitlementEnforcement>;
  let spacesRepository: MockedObject<Pick<ISpacesRepository, 'findIdByUuid'>>;
  let target: EntitlementGuard;

  /** The base is only reachable through a per-feature subclass. */
  class TestEntitlementGuard extends EntitlementGuard {
    public constructor(
      enforcement: IEntitlementEnforcement,
      spaces: ISpacesRepository,
    ) {
      super(enforcement, spaces, 'safe_seats');
    }
  }

  function context(params: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ params }) }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    entitlementEnforcement = {
      assertWithinQuota: vi.fn(),
      prepareQuotaCheck: vi.fn(),
    };
    spacesRepository = { findIdByUuid: vi.fn().mockResolvedValue(spaceId) };
    target = new TestEntitlementGuard(
      entitlementEnforcement,
      spacesRepository as MockedObject<ISpacesRepository>,
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
