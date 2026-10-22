// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import type { ILoggingService } from '#/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { requestConfigurationEncoder } from '#/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { safePolicyGuardConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/safe-policy-guard-configuration.builder';
import { policyIndexerConfigurationRootBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/configuration-root.builder';
import { policyIndexerResponseBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import type { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import type { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { PolicyConfigurationRequestsService } from '#/modules/policies/routes/policy-configuration-requests.service';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

describe('PolicyConfigurationRequestsService', () => {
  const configurationRequestsRepository: MockedObject<ISafePolicyGuardConfigurationRequestsRepository> =
    { create: vi.fn(), findBySafes: vi.fn(), delete: vi.fn() };
  const membersRepository: MockedObject<Pick<IMembersRepository, 'findOne'>> = {
    findOne: vi.fn(),
  };
  const spaceSafesRepository: MockedObject<
    Pick<ISpaceSafesRepository, 'existsInSpace'>
  > = { existsInSpace: vi.fn() };
  const policyIndexerRepository: MockedObject<
    Pick<IPolicyIndexerRepository, 'getState'>
  > = { getState: vi.fn() };
  const safeRepository: MockedObject<
    Pick<
      ISafeRepository,
      'getSafe' | 'getTransactionQueue' | 'getTransactionQueueMaxPageSize'
    >
  > = {
    getSafe: vi.fn(),
    getTransactionQueue: vi.fn(),
    getTransactionQueueMaxPageSize: vi.fn(),
  };

  const loggingService: MockedObject<Pick<ILoggingService, 'warn'>> = {
    warn: vi.fn(),
  };

  const target = new PolicyConfigurationRequestsService(
    configurationRequestsRepository,
    membersRepository as MockedObject<IMembersRepository>,
    spaceSafesRepository as MockedObject<ISpaceSafesRepository>,
    policyIndexerRepository as MockedObject<IPolicyIndexerRepository>,
    safeRepository as MockedObject<ISafeRepository>,
    new MultiSendDecoder(loggingService as MockedObject<ILoggingService>),
    new SafePolicyGuardDecoder(),
    loggingService as MockedObject<ILoggingService>,
  );

  const spaceId = faker.number.int({ min: 1, max: 100 });
  const userId = faker.number.int({ min: 1, max: 100 });
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
    ).rejects.toThrow(new ForbiddenException());
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  describe('delete', () => {
    const root = configurationRoot([policyConfigurationBuilder().build()]);
    const guard = getSafePolicyGuardDeployments(safe.chainId)[0];

    function queue(transactions: Array<MultisigTransaction>): void {
      safeRepository.getTransactionQueue.mockResolvedValue(
        pageBuilder<MultisigTransaction>()
          .with('results', transactions)
          .with('next', null)
          .build(),
      );
    }

    beforeEach(() => {
      configurationRequestsRepository.findBySafes.mockResolvedValue([
        safePolicyGuardConfigurationBuilder()
          .with('chainId', safe.chainId)
          .with('safeAddress', safe.address)
          .with('root', root)
          .build(),
      ]);
      configurationRequestsRepository.delete.mockResolvedValue();
      policyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder().build(),
      );
      safeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('address', safe.address).build(),
      );
      safeRepository.getTransactionQueueMaxPageSize.mockReturnValue(20);
      queue([]);
    });

    it('should delete a draft, matching the root lower-cased', async () => {
      const upperCased: Hex = `0x${root.slice(2).toUpperCase()}`;

      await expect(
        target.delete({ ...request, root: upperCased }),
      ).resolves.toBeUndefined();
      expect(policyIndexerRepository.getState).toHaveBeenCalledWith({
        safes: [safe],
        guardPolicyKinds: [],
      });
      expect(configurationRequestsRepository.delete).toHaveBeenCalledWith({
        spaceId,
        safe,
        root,
      });
    });

    it('should reject a root that exists on-chain', async () => {
      policyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('roots', [
            policyIndexerConfigurationRootBuilder()
              .with('chainId', safe.chainId)
              .with('safe', safe.address)
              .with('root', root)
              .build(),
          ])
          .build(),
      );

      await expect(target.delete({ ...request, root })).rejects.toThrow(
        new HttpExceptionNoLog(
          'Only a draft configuration request can be deleted',
          HttpStatus.CONFLICT,
        ),
      );
      expect(configurationRequestsRepository.delete).not.toHaveBeenCalled();
    });

    it('should reject a root a queued transaction requests', async () => {
      queue([
        multisigTransactionBuilder()
          .with('to', guard)
          .with('operation', Operation.CALL)
          .with(
            'data',
            requestConfigurationEncoder().with('configureRoot', root).encode(),
          )
          .build(),
      ]);

      await expect(target.delete({ ...request, root })).rejects.toThrow(
        new HttpExceptionNoLog(
          'Only a draft configuration request can be deleted',
          HttpStatus.CONFLICT,
        ),
      );
      expect(configurationRequestsRepository.delete).not.toHaveBeenCalled();
    });

    it('should reject a root when the queue is truncated at the page cap', async () => {
      safeRepository.getTransactionQueue.mockResolvedValue(
        pageBuilder<MultisigTransaction>()
          .with('results', [])
          .with('next', faker.internet.url())
          .build(),
      );

      await expect(target.delete({ ...request, root })).rejects.toThrow(
        new HttpExceptionNoLog(
          'Only a draft configuration request can be deleted',
          HttpStatus.CONFLICT,
        ),
      );
      expect(configurationRequestsRepository.delete).not.toHaveBeenCalled();
    });

    it('should ignore a request of the root on an unknown contract', async () => {
      queue([
        multisigTransactionBuilder()
          .with('to', getAddress(faker.finance.ethereumAddress()))
          .with('operation', Operation.CALL)
          .with(
            'data',
            requestConfigurationEncoder().with('configureRoot', root).encode(),
          )
          .build(),
      ]);

      await target.delete({ ...request, root });

      expect(configurationRequestsRepository.delete).toHaveBeenCalled();
    });

    it('should reject a root that is not stored', async () => {
      configurationRequestsRepository.findBySafes.mockResolvedValue([]);

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
        new ForbiddenException(),
      );
      expect(configurationRequestsRepository.delete).not.toHaveBeenCalled();
    });
  });
});
