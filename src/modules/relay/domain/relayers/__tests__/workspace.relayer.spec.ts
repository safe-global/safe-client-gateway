// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import type { ITenderlySimulationApi } from '@/domain/interfaces/tenderly-simulation-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { relayerBuilder } from '@/modules/chains/domain/entities/__tests__/relayer.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type {
  ConsumedQuota,
  IEntitlementEnforcement,
} from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { GasPaymentOption } from '@/modules/relay/domain/entities/gas-payment-option.entity';
import { GasPaymentOptionUnavailableError } from '@/modules/relay/domain/errors/gas-payment-option-unavailable.error';
import { RelaySimulationFailedError } from '@/modules/relay/domain/errors/relay-simulation-failed.error';
import { RelaySimulationIndeterminateError } from '@/modules/relay/domain/errors/relay-simulation-indeterminate.error';
import type { RelaySubmitter } from '@/modules/relay/domain/interfaces/relayer.interface';
import type { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import { RelaySimulationService } from '@/modules/relay/domain/relay-simulation.service';
import { WorkspaceRelayer } from '@/modules/relay/domain/relayers/workspace.relayer';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';

const mockLimitAddressesMapper = vi.mocked({
  resolveTarget: vi.fn(),
  getLimitAddresses: vi.fn(),
} as MockedObject<LimitAddressesMapper>);

const mockRelayApi = vi.mocked({
  relay: vi.fn(),
  getTaskStatus: vi.fn(),
  getRelayCount: vi.fn(),
  setRelayCount: vi.fn(),
} as MockedObject<IRelayApi>);

const mockEntitlementEnforcement = vi.mocked({
  assertWithinQuota: vi.fn(),
  prepareQuotaCheck: vi.fn(),
  consumeQuota: vi.fn(),
  refundQuota: vi.fn(),
} as MockedObject<IEntitlementEnforcement>);

const mockLoggingService = vi.mocked({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>);

const mockSpaceSafesRepository = vi.mocked({
  existsInSpace: vi.fn(),
} as MockedObject<ISpaceSafesRepository>);

const mockChainsRepository = vi.mocked({
  getChain: vi.fn(),
} as MockedObject<IChainsRepository>);

const mockTenderlySimulationApi = vi.mocked({
  simulate: vi.fn(),
} as MockedObject<ITenderlySimulationApi>);

describe('WorkspaceRelayer', () => {
  let target: WorkspaceRelayer;

  const address = (): Address => getAddress(faker.finance.ethereumAddress());

  function callArgs(): {
    spaceId: number;
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
  } {
    return {
      spaceId: faker.number.int({ min: 1, max: 1_000 }),
      version: faker.system.semver(),
      chainId: faker.string.numeric(),
      to: address(),
      data: faker.string.hexadecimal({ length: 64 }) as Hex,
    };
  }

  /** What the relay manager hands the submitter, the chain's switch included. */
  function relayArgs(
    args: ReturnType<typeof callArgs>,
    simulationEnabled = false,
  ): Parameters<RelaySubmitter['relay']>[0] {
    return {
      version: args.version,
      chainId: args.chainId,
      to: args.to,
      data: args.data,
      gasLimit: null,
      simulationEnabled,
    };
  }

  /** What the mapper recognised: a Safe, or none to attribute the call to. */
  function recognises(safe: Address | null): void {
    mockLimitAddressesMapper.resolveTarget.mockResolvedValue({
      safe,
      addresses: [safe ?? address()],
    });
  }

  function relayerConfig(relayer: Chain['relayer']): void {
    mockChainsRepository.getChain.mockResolvedValue(
      chainBuilder().with('relayer', relayer).build(),
    );
  }

  /** What `consumeQuota` hands back: the counter it charged, and by how much. */
  function spend(spaceId: Space['id'] = faker.number.int()): ConsumedQuota {
    return {
      spaceId,
      period: {
        featureId: faker.number.int({ min: 1, max: 1000 }),
        periodStart: faker.date.recent(),
      },
      delta: 1,
    };
  }

  /** The submitter for a held Safe, or for a call with no Safe. */
  async function submitterFor(
    args: ReturnType<typeof callArgs>,
    safe: Address | null = address(),
  ): Promise<RelaySubmitter> {
    recognises(safe);
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    return await target.forSpace(args);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    relayerConfig(
      relayerBuilder()
        .with('gasPaymentOptions', [GasPaymentOption.SUBSCRIPTION])
        .build(),
    );
    mockEntitlementEnforcement.consumeQuota.mockResolvedValue(spend());
    mockEntitlementEnforcement.refundQuota.mockResolvedValue(undefined);
    // Real, over a mocked simulator: the cases below are about what a
    // simulation result does to a relay, which a double would not decide.
    const relaySimulationService = new RelaySimulationService(
      mockLoggingService,
      mockTenderlySimulationApi,
    );

    target = new WorkspaceRelayer(
      mockLimitAddressesMapper,
      mockRelayApi,
      mockEntitlementEnforcement,
      mockSpaceSafesRepository,
      mockChainsRepository,
      relaySimulationService,
      mockLoggingService,
    );
  });

  describe('forSpace', () => {
    it('should admit a Safe the workspace holds without spending', async () => {
      const args = callArgs();
      const safe = address();
      recognises(safe);
      mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);

      await expect(target.forSpace(args)).resolves.toBeDefined();

      expect(mockSpaceSafesRepository.existsInSpace).toHaveBeenCalledWith({
        spaceId: args.spaceId,
        chainId: args.chainId,
        address: safe,
      });
      expect(
        mockEntitlementEnforcement.assertWithinQuota,
      ).not.toHaveBeenCalled();
      expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
    });

    it('should deny a Safe the workspace does not hold, whatever the chain lists', async () => {
      const args = callArgs();
      recognises(address());
      mockSpaceSafesRepository.existsInSpace.mockResolvedValue(false);
      const relayer = relayerBuilder().build();
      relayerConfig(relayer);

      await expect(target.forSpace(args)).rejects.toThrow(
        new GasPaymentOptionUnavailableError({
          requested: GasPaymentOption.SUBSCRIPTION,
          reason: 'NOT_A_WORKSPACE_SAFE',
          available: relayer.gasPaymentOptions,
        }),
      );
    });

    it('should deny a Safe the workspace does not hold on a chain without a relayer', async () => {
      const args = callArgs();
      recognises(address());
      mockSpaceSafesRepository.existsInSpace.mockResolvedValue(false);
      relayerConfig(null);

      await expect(target.forSpace(args)).rejects.toThrow(
        new GasPaymentOptionUnavailableError({
          requested: GasPaymentOption.SUBSCRIPTION,
          reason: 'NOT_A_WORKSPACE_SAFE',
          available: [],
        }),
      );
    });

    it('should admit a call with no Safe to attribute', async () => {
      const args = callArgs();
      // A Safe creation or a passkey signer deployment: nothing to hold yet.
      recognises(null);

      await expect(target.forSpace(args)).resolves.toBeDefined();

      expect(mockSpaceSafesRepository.existsInSpace).not.toHaveBeenCalled();
    });

    it('should refuse calldata it cannot recognise', async () => {
      const args = callArgs();
      const invalid = new Error(faker.lorem.sentence());
      mockLimitAddressesMapper.resolveTarget.mockRejectedValue(invalid);

      await expect(target.forSpace(args)).rejects.toThrow(invalid);
    });
  });

  describe('relay', () => {
    it('should spend one unit of the allowance and relay', async () => {
      const args = callArgs();
      const taskId = faker.string.uuid();
      const submitter = await submitterFor(args);
      mockRelayApi.relay.mockResolvedValue({ taskId });

      await expect(submitter.relay(relayArgs(args))).resolves.toStrictEqual({
        taskId,
      });

      expect(
        mockEntitlementEnforcement.consumeQuota,
      ).toHaveBeenCalledExactlyOnceWith({
        spaceId: args.spaceId,
        featureKey: 'sponsored_transactions',
        delta: 1,
      });
    });

    it('should relay a call with no Safe to attribute', async () => {
      const args = callArgs();
      const taskId = faker.string.uuid();
      const submitter = await submitterFor(args, null);
      mockRelayApi.relay.mockResolvedValue({ taskId });

      await expect(submitter.relay(relayArgs(args))).resolves.toStrictEqual({
        taskId,
      });

      expect(mockEntitlementEnforcement.consumeQuota).toHaveBeenCalledTimes(1);
    });

    it('should not relay once the allowance is spent', async () => {
      const args = callArgs();
      const submitter = await submitterFor(args, args.to);
      const quotaExceeded = new QuotaExceededError({
        feature: 'sponsored_transactions',
        quota: faker.number.int({ min: 1, max: 10 }),
        used: faker.number.int({ min: 1, max: 10 }),
        resetsAt: faker.date.future(),
      });
      mockEntitlementEnforcement.assertWithinQuota.mockRejectedValue(
        quotaExceeded,
      );

      await expect(submitter.relay(relayArgs(args, true))).rejects.toThrow(
        quotaExceeded,
      );

      // Refused before the simulation and before anything is spent.
      expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
      expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it('should simulate the transaction against the Safe itself', async () => {
      const args = callArgs();
      const submitter = await submitterFor(args, args.to);
      mockTenderlySimulationApi.simulate.mockResolvedValue({
        status: 'success',
      });
      mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

      await submitter.relay(relayArgs(args, true));

      expect(mockTenderlySimulationApi.simulate).toHaveBeenCalledWith(
        expect.objectContaining({ to: args.to }),
      );
    });

    it('should not simulate a batch or a recovery', async () => {
      const args = callArgs();
      // Addressed to MultiSend or the DelayModifier, not to the Safe.
      const submitter = await submitterFor(args, address());
      mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

      await submitter.relay(relayArgs(args, true));

      expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
    });

    it('should not simulate a call with no Safe to attribute', async () => {
      const args = callArgs();
      // A Safe creation or a signer deployment.
      const submitter = await submitterFor(args, null);
      mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

      await submitter.relay(relayArgs(args, true));

      expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
      expect(mockEntitlementEnforcement.consumeQuota).toHaveBeenCalledTimes(1);
    });

    it('should not simulate where the chain has it switched off', async () => {
      const args = callArgs();
      const submitter = await submitterFor(args, args.to);
      mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

      await submitter.relay(relayArgs(args, false));

      expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
    });

    it('should not spend the allowance on a transaction that would revert', async () => {
      const args = callArgs();
      const submitter = await submitterFor(args, args.to);
      mockTenderlySimulationApi.simulate.mockResolvedValue({
        status: 'failed',
        reason: faker.lorem.sentence(),
      });

      await expect(submitter.relay(relayArgs(args, true))).rejects.toThrow(
        RelaySimulationFailedError,
      );

      expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it('should defer when the simulator cannot be reached', async () => {
      const args = callArgs();
      const submitter = await submitterFor(args, args.to);
      mockTenderlySimulationApi.simulate.mockResolvedValue({
        status: 'indeterminate',
        reason: faker.lorem.sentence(),
      });

      await expect(submitter.relay(relayArgs(args, true))).rejects.toThrow(
        RelaySimulationIndeterminateError,
      );
    });

    it('should relay an unverified simulation the caller accepted', async () => {
      const args = callArgs();
      const submitter = await submitterFor(args, args.to);
      mockTenderlySimulationApi.simulate.mockResolvedValue({
        status: 'indeterminate',
        reason: faker.lorem.sentence(),
      });
      mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

      await expect(
        submitter.relay({
          ...relayArgs(args, true),
          acceptUnverifiedSimulation: true,
        }),
      ).resolves.toBeDefined();
    });

    it('should give the allowance back when the relay fails', async () => {
      const args = callArgs();
      const submitter = await submitterFor(args);
      // Whatever it answered, no taskId came back.
      const failed = new DataSourceError(
        faker.lorem.sentence(),
        faker.helpers.arrayElement([
          HttpStatus.BAD_REQUEST,
          HttpStatus.BAD_GATEWAY,
          HttpStatus.SERVICE_UNAVAILABLE,
        ]),
      );
      mockRelayApi.relay.mockRejectedValue(failed);
      // Credited to the spend itself, not to whatever period the plan names by
      // then: the cycle can have moved while the relay was in flight.
      const spentQuota = spend(args.spaceId);
      mockEntitlementEnforcement.consumeQuota.mockResolvedValue(spentQuota);

      await expect(submitter.relay(relayArgs(args))).rejects.toThrow(failed);

      expect(
        mockEntitlementEnforcement.refundQuota,
      ).toHaveBeenCalledExactlyOnceWith(spentQuota);
    });

    it('should keep a relay whose refund could not be written', async () => {
      const args = callArgs();
      const submitter = await submitterFor(args);
      mockRelayApi.relay.mockRejectedValue(
        new DataSourceError(faker.lorem.sentence()),
      );
      mockEntitlementEnforcement.consumeQuota.mockResolvedValue(
        spend(args.spaceId),
      );
      mockEntitlementEnforcement.refundQuota.mockRejectedValue(
        new Error(faker.lorem.sentence()),
      );

      await expect(submitter.relay(relayArgs(args))).rejects.toThrow(
        DataSourceError,
      );

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.QuotaNotRefunded,
          spaceId: args.spaceId,
          feature: 'sponsored_transactions',
        }),
      );
    });
  });
});
