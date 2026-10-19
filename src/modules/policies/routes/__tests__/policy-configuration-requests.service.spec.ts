// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { getAddress, type Hex, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import type { ILoggingService } from '#/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { EVERY_ROOT_ACTIVE } from '#/modules/policies/domain/entities/active-roots-rule.entity';
import { policyIndexerConfigurationRootBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/configuration-root.builder';
import { policyIndexerResponseBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import type { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import type { ISafePolicyGuardRepository } from '#/modules/policies/domain/safe-policy-guard.repository.interface';
import type { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { PolicyConfigurationRequestsService } from '#/modules/policies/routes/policy-configuration-requests.service';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

describe('PolicyConfigurationRequestsService', () => {
  const configurationRequestsRepository: MockedObject<
    Pick<ISafePolicyGuardConfigurationRequestsRepository, 'create'>
  > = { create: vi.fn() };
  const membersRepository: MockedObject<Pick<IMembersRepository, 'findOne'>> = {
    findOne: vi.fn(),
  };
  const spaceSafesRepository: MockedObject<
    Pick<ISpaceSafesRepository, 'existsInSpace'>
  > = { existsInSpace: vi.fn() };
  const policyIndexerRepository: MockedObject<
    Pick<IPolicyIndexerRepository, 'getState'>
  > = { getState: vi.fn() };
  const safePolicyGuardRepository: MockedObject<ISafePolicyGuardRepository> = {
    getExpiry: vi.fn(),
    getExpiries: vi.fn(),
    getDelay: vi.fn(),
  };
  const safeRepository: MockedObject<Pick<ISafeRepository, 'getSafe'>> = {
    getSafe: vi.fn(),
  };
  const loggingService: MockedObject<Pick<ILoggingService, 'warn'>> = {
    warn: vi.fn(),
  };

  const target = new PolicyConfigurationRequestsService(
    configurationRequestsRepository as MockedObject<ISafePolicyGuardConfigurationRequestsRepository>,
    membersRepository as MockedObject<IMembersRepository>,
    spaceSafesRepository as MockedObject<ISpaceSafesRepository>,
    policyIndexerRepository as MockedObject<IPolicyIndexerRepository>,
    safePolicyGuardRepository,
    safeRepository as MockedObject<ISafeRepository>,
    loggingService as MockedObject<ILoggingService>,
  );

  const spaceId = faker.number.int({ min: 1, max: 100 });
  const userId = faker.number.int({ min: 1, max: 100 });
  // A chain with known SafePolicyGuard deployments.
  const safe = {
    chainId: '11155111',
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const request = {
    spaceId,
    safe,
    authPayload: new AuthPayload(
      siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
    ),
  };

  /** A payload whose root is the hash of its configurations. */
  function validPayload(): {
    root: Hex;
    configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>];
  } {
    const configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>] =
      [policyConfigurationBuilder().build()];
    return { root: configurationRoot(configurations), configurations };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    membersRepository.findOne.mockResolvedValue(memberBuilder().build());
    spaceSafesRepository.existsInSpace.mockResolvedValue(true);
    configurationRequestsRepository.create.mockResolvedValue();
    policyIndexerRepository.getState.mockResolvedValue(
      policyIndexerResponseBuilder().with('roots', []).build(),
    );
    safeRepository.getSafe.mockResolvedValue(
      safeBuilder().with('guard', zeroAddress).build(),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should store the configurations of a root', async () => {
    const payload = validPayload();

    await expect(target.create({ ...request, payload })).resolves.toStrictEqual(
      { root: payload.root },
    );
    expect(spaceSafesRepository.existsInSpace).toHaveBeenCalledWith({
      spaceId,
      chainId: safe.chainId,
      address: safe.address,
    });
    expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
      {
        spaceId,
        chainId: safe.chainId,
        safeAddress: safe.address,
        root: payload.root,
        configurations: payload.configurations,
        createdBy: userId,
      },
      { onChain: new Map(), draftsSince: null },
    );
  });

  describe('active roots', () => {
    const [guard] = getSafePolicyGuardDeployments(safe.chainId);
    const now = faker.date.recent();
    const nowSeconds = Math.floor(now.getTime() / 1_000);
    const delay = faker.number.int({ min: 60, max: 3_600 });
    const expiry = faker.number.int({ min: 60, max: 86_400 });

    beforeEach(() => {
      vi.useFakeTimers({ now });
      safePolicyGuardRepository.getDelay.mockResolvedValue(delay);
      safePolicyGuardRepository.getExpiries.mockImplementation(({ guards }) =>
        Promise.resolve(new Map(guards.map((known) => [known, expiry]))),
      );
    });

    it('should count on-chain roots only while they can still be applied', async () => {
      const root = (
        status: 'PENDING' | 'APPLIED' | 'INVALIDATED',
        readyAt: number,
      ) =>
        policyIndexerConfigurationRootBuilder()
          .with('guard', guard)
          .with('status', status)
          .with('readyAt', readyAt)
          .build();
      const live = root('PENDING', nowSeconds);
      const expired = root('PENDING', nowSeconds - expiry);
      const applied = root('APPLIED', nowSeconds);
      const invalidated = root('INVALIDATED', nowSeconds);
      policyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('roots', [live, expired, applied, invalidated])
          .build(),
      );

      await target.create({ ...request, payload: validPayload() });

      expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
        expect.anything(),
        {
          onChain: new Map([
            [live.root, true],
            [expired.root, false],
            [applied.root, false],
            [invalidated.root, false],
          ]),
          draftsSince: null,
        },
      );
      // One read per guard of a pending root, none for settled roots.
      expect(safePolicyGuardRepository.getExpiries).toHaveBeenCalledWith({
        chainId: safe.chainId,
        guards: [guard],
      });
    });

    it('should count a pending root of an unknown guard without reading its EXPIRY', async () => {
      const unknown = policyIndexerConfigurationRootBuilder()
        .with('guard', getAddress(faker.finance.ethereumAddress()))
        .with('status', 'PENDING')
        .with('readyAt', nowSeconds - expiry)
        .build();
      policyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder().with('roots', [unknown]).build(),
      );

      await target.create({ ...request, payload: validPayload() });

      expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
        expect.anything(),
        { onChain: new Map([[unknown.root, true]]), draftsSince: null },
      );
      expect(safePolicyGuardRepository.getExpiries).toHaveBeenCalledWith({
        chainId: safe.chainId,
        guards: [],
      });
    });

    it("should only count drafts younger than the known guard's delay and expiry", async () => {
      // Either slot holds the guard; the module guard alone is enough.
      safeRepository.getSafe.mockResolvedValue(
        safeBuilder()
          .with('guard', zeroAddress)
          .with('moduleGuard', guard)
          .build(),
      );

      await target.create({ ...request, payload: validPayload() });

      expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
        expect.anything(),
        {
          onChain: new Map(),
          draftsSince: new Date((nowSeconds - delay - expiry) * 1_000),
        },
      );
      expect(safePolicyGuardRepository.getDelay).toHaveBeenCalledWith({
        chainId: safe.chainId,
        guard,
      });
    });

    it('should not age drafts by a guard that is not a known deployment', async () => {
      safeRepository.getSafe.mockResolvedValue(
        safeBuilder()
          .with('guard', getAddress(faker.finance.ethereumAddress()))
          .build(),
      );

      await target.create({ ...request, payload: validPayload() });

      expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
        expect.anything(),
        { onChain: new Map(), draftsSince: null },
      );
      expect(safePolicyGuardRepository.getDelay).not.toHaveBeenCalled();
    });

    it('should count every root when chain state cannot be read', async () => {
      policyIndexerRepository.getState.mockRejectedValue(new Error('down'));

      await target.create({ ...request, payload: validPayload() });

      expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
        expect.anything(),
        EVERY_ROOT_ACTIVE,
      );
      expect(loggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could not read the active configuration roots of a Safe',
        }),
      );
    });
  });

  it('should reject configurations that do not hash to the root without logging', async () => {
    const payload = validPayload();

    await expect(
      target.create({
        ...request,
        payload: { ...payload, root: `0x${'11'.repeat(32)}` },
      }),
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        'The configurations do not hash to the given root',
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  it('should store an upper-cased root under its canonical casing', async () => {
    const payload = validPayload();
    const upperCased: Hex = `0x${payload.root.slice(2).toUpperCase()}`;

    await expect(
      target.create({ ...request, payload: { ...payload, root: upperCased } }),
    ).resolves.toStrictEqual({ root: payload.root });
    expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ root: payload.root }),
      expect.anything(),
    );
  });

  it('should reject a caller who is not a member of the space', async () => {
    membersRepository.findOne.mockResolvedValue(null);

    await expect(
      target.create({ ...request, payload: validPayload() }),
    ).rejects.toThrow('User is not a member of this workspace');
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  it('should reject a Safe that is not in the space', async () => {
    spaceSafesRepository.existsInSpace.mockResolvedValue(false);

    await expect(
      target.create({ ...request, payload: validPayload() }),
    ).rejects.toThrow(new ForbiddenException());
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });
});
