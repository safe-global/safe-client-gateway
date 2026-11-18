// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { type Address, getAddress, type Hex, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import type { ILoggingService } from '#/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { policyIndexerConfigurationRootBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/configuration-root.builder';
import { policyIndexerResponseBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import type { PolicyIndexerConfigurationRoot } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import {
  getPolicyContracts,
  POLICY_ENGINE_CHAIN_IDS,
} from '#/modules/policies/domain/policy-deployments.constants';
import type { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import type { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import {
  GUARD_POLICY_TYPES,
  guardPolicyKindsOf,
} from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { PolicyConfigurationRequestsService } from '#/modules/policies/routes/policy-configuration-requests.service';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

const POLICY_ENGINE_CHAIN_ID = faker.helpers.arrayElement([
  ...POLICY_ENGINE_CHAIN_IDS,
]);
const KNOWN_POLICY = faker.helpers.arrayElement(
  getPolicyContracts(POLICY_ENGINE_CHAIN_ID),
);
/** Gnosis Chain, which has no policy engine. */
const NON_POLICY_ENGINE_CHAIN_ID = '100';

describe('PolicyConfigurationRequestsService', () => {
  const configurationRequestsRepository: MockedObject<ISafePolicyGuardConfigurationRequestsRepository> =
    {
      create: vi.fn(),
      findRootsBySafe: vi.fn(),
      findBySafes: vi.fn(),
      delete: vi.fn(),
    };
  const membersRepository: MockedObject<Pick<IMembersRepository, 'findOne'>> = {
    findOne: vi.fn(),
  };
  const spaceSafesRepository: MockedObject<
    Pick<ISpaceSafesRepository, 'existsInSpace'>
  > = { existsInSpace: vi.fn() };
  const policyIndexerRepository: MockedObject<
    Pick<IPolicyIndexerRepository, 'getState'>
  > = { getState: vi.fn() };
  const loggingService: MockedObject<Pick<ILoggingService, 'warn'>> = {
    warn: vi.fn(),
  };
  const maxPerSpaceSafe = faker.number.int({ min: 2, max: 5 });
  const configurationService = new FakeConfigurationService();
  configurationService.set(
    'policies.maxConfigurationRequestsPerSpaceSafe',
    maxPerSpaceSafe,
  );

  const target = new PolicyConfigurationRequestsService(
    configurationRequestsRepository,
    membersRepository as MockedObject<IMembersRepository>,
    spaceSafesRepository as MockedObject<ISpaceSafesRepository>,
    policyIndexerRepository as MockedObject<IPolicyIndexerRepository>,
    configurationService,
    loggingService as MockedObject<ILoggingService>,
  );

  const spaceId = faker.number.int({ min: 1, max: 100 });
  const userId = faker.number.int({ min: 1, max: 100 });
  const safe = {
    chainId: POLICY_ENGINE_CHAIN_ID,
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
  function validPayload(policy: Address = KNOWN_POLICY): {
    root: Hex;
    configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>];
  } {
    const configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>] =
      [policyConfigurationBuilder().with('policy', policy).build()];
    return { root: configurationRoot(configurations), configurations };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    membersRepository.findOne.mockResolvedValue(memberBuilder().build());
    spaceSafesRepository.existsInSpace.mockResolvedValue(true);
    configurationRequestsRepository.create.mockResolvedValue();
    configurationRequestsRepository.findRootsBySafe.mockResolvedValue([]);
    policyIndexerRepository.getState.mockResolvedValue(
      policyIndexerResponseBuilder().build(),
    );
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
    expect(configurationRequestsRepository.create).toHaveBeenCalledWith({
      spaceId,
      chainId: safe.chainId,
      safeAddress: safe.address,
      root: payload.root,
      configurations: payload.configurations,
      createdBy: userId,
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

  it('should store the removal of a policy', async () => {
    const payload = validPayload(zeroAddress);

    await expect(target.create({ ...request, payload })).resolves.toStrictEqual(
      { root: payload.root },
    );
    expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ configurations: payload.configurations }),
    );
  });

  it('should reject the removal of a policy on a chain without a policy engine', async () => {
    const chainId = NON_POLICY_ENGINE_CHAIN_ID;

    await expect(
      target.create({
        ...request,
        safe: { ...safe, chainId },
        payload: validPayload(zeroAddress),
      }),
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        `Policies are not supported on chain ${chainId}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  it('should reject an unknown policy contract without logging', async () => {
    const policy = getAddress(faker.finance.ethereumAddress());

    await expect(
      target.create({ ...request, payload: validPayload(policy) }),
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        `Unknown policy contract ${policy} on chain ${safe.chainId}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  it('should reject an unknown policy contract after a known one', async () => {
    const policy = getAddress(faker.finance.ethereumAddress());
    const configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>] =
      [
        policyConfigurationBuilder().with('policy', KNOWN_POLICY).build(),
        policyConfigurationBuilder().with('policy', policy).build(),
      ];

    await expect(
      target.create({
        ...request,
        payload: { root: configurationRoot(configurations), configurations },
      }),
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        `Unknown policy contract ${policy} on chain ${safe.chainId}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  it('should reject a known policy contract on a chain without a policy engine', async () => {
    const chainId = NON_POLICY_ENGINE_CHAIN_ID;

    await expect(
      target.create({
        ...request,
        safe: { ...safe, chainId },
        payload: validPayload(),
      }),
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        `Policies are not supported on chain ${chainId}`,
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
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        'Safe is not in this workspace',
        HttpStatus.FORBIDDEN,
      ),
    );
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  describe('cap', () => {
    const now = faker.date.recent();
    const nowSeconds = Math.floor(now.getTime() / 1_000);

    beforeEach(() => {
      vi.useFakeTimers({ now });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const capError = new HttpExceptionNoLog(
      `This Safe only allows a maximum of ${maxPerSpaceSafe} active policy configuration requests in this space.`,
      HttpStatus.BAD_REQUEST,
    );

    /** Stores {@link maxPerSpaceSafe} roots for the Safe. */
    function fillCap(): Array<Hex> {
      const stored = Array.from(
        { length: maxPerSpaceSafe },
        () => validPayload().root,
      );
      configurationRequestsRepository.findRootsBySafe.mockResolvedValue(stored);
      return stored;
    }

    /** The on-chain root of a stored configuration. */
    function onChain(
      root: Hex,
      status: PolicyIndexerConfigurationRoot['status'],
      expiresAt: number,
    ): PolicyIndexerConfigurationRoot {
      return policyIndexerConfigurationRootBuilder()
        .with('root', root)
        .with('status', status)
        .with('expiresAt', expiresAt)
        .build();
    }

    it('should reject a new root once the Safe holds the maximum', async () => {
      fillCap();

      await expect(
        target.create({ ...request, payload: validPayload() }),
      ).rejects.toThrow(capError);
      expect(
        configurationRequestsRepository.findRootsBySafe,
      ).toHaveBeenCalledWith({ spaceId, safe });
      expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should accept a stored root again at the maximum', async () => {
      const payload = validPayload();
      configurationRequestsRepository.findRootsBySafe.mockResolvedValue([
        payload.root,
        ...fillCap().slice(1),
      ]);

      await expect(
        target.create({ ...request, payload }),
      ).resolves.toStrictEqual({ root: payload.root });
      expect(policyIndexerRepository.getState).not.toHaveBeenCalled();
    });

    it.each([
      ['applied', 'APPLIED' as const, 1],
      ['invalidated', 'INVALIDATED' as const, 1],
      ['expired', 'PENDING' as const, 0],
    ])(
      'should not count a root that is %s on-chain',
      async (_, status, expiresIn) => {
        const [closed] = fillCap();
        policyIndexerRepository.getState.mockResolvedValue(
          policyIndexerResponseBuilder()
            .with('roots', [onChain(closed, status, nowSeconds + expiresIn)])
            .build(),
        );

        const payload = validPayload();

        await expect(
          target.create({ ...request, payload }),
        ).resolves.toStrictEqual({ root: payload.root });
        expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ root: payload.root }),
        );
        expect(policyIndexerRepository.getState).toHaveBeenCalledWith({
          safes: [safe],
          guardPolicyKinds: guardPolicyKindsOf(GUARD_POLICY_TYPES),
        });
      },
    );

    it('should count a root that can still be applied', async () => {
      const [open] = fillCap();
      policyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('roots', [onChain(open, 'PENDING', nowSeconds + 1)])
          .build(),
      );

      await expect(
        target.create({ ...request, payload: validPayload() }),
      ).rejects.toThrow(capError);
    });

    it('should count a root closed on one guard but open on another', async () => {
      const [root] = fillCap();
      policyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('roots', [
            onChain(root, 'APPLIED', nowSeconds + 1),
            onChain(root, 'PENDING', nowSeconds + 1),
          ])
          .build(),
      );

      await expect(
        target.create({ ...request, payload: validPayload() }),
      ).rejects.toThrow(capError);
    });

    it('should count every stored root when the indexer cannot be read', async () => {
      fillCap();
      policyIndexerRepository.getState.mockRejectedValue(new Error('down'));

      await expect(
        target.create({ ...request, payload: validPayload() }),
      ).rejects.toThrow(capError);
      expect(loggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could not read the configuration roots of a Safe',
        }),
      );
    });
  });

  describe('delete', () => {
    const root = configurationRoot([policyConfigurationBuilder().build()]);

    beforeEach(() => {
      configurationRequestsRepository.findRootsBySafe.mockResolvedValue([root]);
      configurationRequestsRepository.delete.mockResolvedValue();
    });

    it('should delete a stored root, matching it lower-cased', async () => {
      const upperCased: Hex = `0x${root.slice(2).toUpperCase()}`;

      await expect(
        target.delete({ ...request, root: upperCased }),
      ).resolves.toBeUndefined();
      expect(configurationRequestsRepository.delete).toHaveBeenCalledWith({
        spaceId,
        safe,
        root,
      });
    });

    it('should reject a root that is not stored', async () => {
      configurationRequestsRepository.findRootsBySafe.mockResolvedValue([]);

      await expect(target.delete({ ...request, root })).rejects.toThrow(
        new HttpExceptionNoLog(
          'No configuration request is stored for this root',
          HttpStatus.NOT_FOUND,
        ),
      );
      expect(configurationRequestsRepository.delete).not.toHaveBeenCalled();
    });

    it('should reject a caller who is not a member of the space', async () => {
      membersRepository.findOne.mockResolvedValue(null);

      await expect(target.delete({ ...request, root })).rejects.toThrow(
        'User is not a member of this workspace',
      );
      expect(configurationRequestsRepository.delete).not.toHaveBeenCalled();
    });

    it('should reject a Safe that is not in the space', async () => {
      spaceSafesRepository.existsInSpace.mockResolvedValue(false);

      await expect(target.delete({ ...request, root })).rejects.toThrow(
        new HttpExceptionNoLog(
          'Safe is not in this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(configurationRequestsRepository.delete).not.toHaveBeenCalled();
    });
  });
});
