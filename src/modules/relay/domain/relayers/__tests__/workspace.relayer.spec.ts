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
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';
import { RelayDeniedError } from '@/modules/relay/domain/errors/relay-denied.error';
import { RelaySimulationFailedError } from '@/modules/relay/domain/errors/relay-simulation-failed.error';
import { RelaySimulationIndeterminateError } from '@/modules/relay/domain/errors/relay-simulation-indeterminate.error';
import { RelayerTypeNotImplementedError } from '@/modules/relay/domain/errors/relayer-type-not-implemented.error';
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

  function relayArgs(): {
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

  /** What the mapper recognised: a Safe, or none to attribute the call to. */
  function recognises(safe: Address | null): void {
    mockLimitAddressesMapper.resolveTarget.mockResolvedValue({
      safe,
      addresses: [safe ?? address()],
    });
  }

  /** The chain's own switch for the pre-relay simulation. */
  function simulationEnabled(enabled: boolean): void {
    relayerConfig(
      relayerBuilder()
        .with('type', RelayerType.DAILY_LIMIT)
        .with('enableTenderlySimulationBeforeRelay', enabled)
        .build(),
    );
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

  beforeEach(() => {
    vi.resetAllMocks();
    simulationEnabled(false);
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

  it('should spend one unit of the allowance and relay', async () => {
    const args = relayArgs();
    const safe = address();
    const taskId = faker.string.uuid();
    recognises(safe);
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    mockRelayApi.relay.mockResolvedValue({ taskId });

    await expect(target.relay(args)).resolves.toStrictEqual({ taskId });

    expect(mockEntitlementEnforcement.consumeQuota).toHaveBeenCalledWith({
      spaceId: args.spaceId,
      featureKey: 'sponsored_transactions',
      delta: 1,
    });
  });

  it('should spend one unit however much the transaction carries', async () => {
    const args = relayArgs();
    recognises(address());
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

    await target.relay(args);

    expect(mockEntitlementEnforcement.consumeQuota).toHaveBeenCalledTimes(1);
  });

  it('should deny a Safe the workspace does not hold', async () => {
    const args = relayArgs();
    const safe = address();
    recognises(safe);
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(false);

    await expect(target.relay(args)).rejects.toThrow(
      new RelayDeniedError(safe, 'not a Safe of this workspace'),
    );

    expect(mockSpaceSafesRepository.existsInSpace).toHaveBeenCalledWith({
      spaceId: args.spaceId,
      chainId: args.chainId,
      address: safe,
    });
    expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
    expect(mockRelayApi.relay).not.toHaveBeenCalled();
  });

  it('should relay a call with no Safe to attribute', async () => {
    const args = relayArgs();
    const taskId = faker.string.uuid();
    // A Safe creation or a passkey signer deployment: nothing to hold yet.
    recognises(null);
    mockRelayApi.relay.mockResolvedValue({ taskId });

    await expect(target.relay(args)).resolves.toStrictEqual({ taskId });

    expect(mockSpaceSafesRepository.existsInSpace).not.toHaveBeenCalled();
    expect(mockEntitlementEnforcement.consumeQuota).toHaveBeenCalledTimes(1);
  });

  it('should not relay once the allowance is spent', async () => {
    const args = relayArgs();
    recognises(null);
    const quotaExceeded = new QuotaExceededError({
      feature: 'sponsored_transactions',
      quota: faker.number.int({ min: 1, max: 10 }),
      used: faker.number.int({ min: 1, max: 10 }),
      resetsAt: faker.date.future(),
    });
    mockEntitlementEnforcement.assertWithinQuota.mockRejectedValue(
      quotaExceeded,
    );

    await expect(target.relay(args)).rejects.toThrow(quotaExceeded);

    // Refused before the simulation and before anything is spent.
    expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
    expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
    expect(mockRelayApi.relay).not.toHaveBeenCalled();
  });

  it('should refuse a chain with no relayer before spending', async () => {
    const args = relayArgs();
    recognises(null);
    relayerConfig(null);

    await expect(target.relay(args)).rejects.toThrow(NoRelayerDefinedError);

    expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
    expect(mockRelayApi.relay).not.toHaveBeenCalled();
  });

  it('should refuse a relayer type that is not implemented', async () => {
    const args = relayArgs();
    recognises(null);
    relayerConfig(relayerBuilder().with('type', RelayerType.GTF).build());

    await expect(target.relay(args)).rejects.toThrow(
      RelayerTypeNotImplementedError,
    );

    expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
  });

  it('should simulate the transaction against the Safe itself', async () => {
    const args = relayArgs();
    recognises(args.to);
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    simulationEnabled(true);
    mockTenderlySimulationApi.simulate.mockResolvedValue({ status: 'success' });
    mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

    await target.relay(args);

    expect(mockTenderlySimulationApi.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ to: args.to }),
    );
  });

  it('should not simulate a batch or a recovery', async () => {
    const args = relayArgs();
    // Addressed to MultiSend or the DelayModifier, not to the Safe.
    recognises(address());
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    simulationEnabled(true);
    mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

    await target.relay(args);

    expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
  });

  it('should not simulate a call with no Safe to attribute', async () => {
    const args = relayArgs();
    // A Safe creation or a signer deployment.
    recognises(null);
    simulationEnabled(true);
    mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

    await target.relay(args);

    expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
    expect(mockEntitlementEnforcement.consumeQuota).toHaveBeenCalledTimes(1);
  });

  it('should not simulate where the chain has it switched off', async () => {
    const args = relayArgs();
    recognises(args.to);
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

    await target.relay(args);

    expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
  });

  it('should not spend the allowance on a transaction that would revert', async () => {
    const args = relayArgs();
    recognises(args.to);
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    simulationEnabled(true);
    mockTenderlySimulationApi.simulate.mockResolvedValue({
      status: 'failed',
      reason: faker.lorem.sentence(),
    });

    await expect(target.relay(args)).rejects.toThrow(
      RelaySimulationFailedError,
    );

    expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
    expect(mockRelayApi.relay).not.toHaveBeenCalled();
  });

  it('should defer when the simulator cannot be reached', async () => {
    const args = relayArgs();
    recognises(args.to);
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    simulationEnabled(true);
    mockTenderlySimulationApi.simulate.mockResolvedValue({
      status: 'indeterminate',
      reason: faker.lorem.sentence(),
    });

    await expect(target.relay(args)).rejects.toThrow(
      RelaySimulationIndeterminateError,
    );
  });

  it('should relay an unverified simulation the caller accepted', async () => {
    const args = relayArgs();
    recognises(args.to);
    mockSpaceSafesRepository.existsInSpace.mockResolvedValue(true);
    simulationEnabled(true);
    mockTenderlySimulationApi.simulate.mockResolvedValue({
      status: 'indeterminate',
      reason: faker.lorem.sentence(),
    });
    mockRelayApi.relay.mockResolvedValue({ taskId: faker.string.uuid() });

    await expect(
      target.relay({ ...args, acceptUnverifiedSimulation: true }),
    ).resolves.toBeDefined();
  });

  it('should not spend the allowance on calldata it cannot recognise', async () => {
    const args = relayArgs();
    const invalid = new Error(faker.lorem.sentence());
    mockLimitAddressesMapper.resolveTarget.mockRejectedValue(invalid);

    await expect(target.relay(args)).rejects.toThrow(invalid);

    expect(mockEntitlementEnforcement.consumeQuota).not.toHaveBeenCalled();
    expect(mockRelayApi.relay).not.toHaveBeenCalled();
  });

  it('should give the allowance back when the relay fails', async () => {
    const args = relayArgs();
    recognises(null);
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

    await expect(target.relay(args)).rejects.toThrow(failed);

    expect(
      mockEntitlementEnforcement.refundQuota,
    ).toHaveBeenCalledExactlyOnceWith(spentQuota);
  });

  it('should keep a relay whose refund could not be written', async () => {
    const args = relayArgs();
    recognises(null);
    mockRelayApi.relay.mockRejectedValue(
      new DataSourceError(faker.lorem.sentence()),
    );
    mockEntitlementEnforcement.consumeQuota.mockResolvedValue(
      spend(args.spaceId),
    );
    mockEntitlementEnforcement.refundQuota.mockRejectedValue(
      new Error(faker.lorem.sentence()),
    );

    await expect(target.relay(args)).rejects.toThrow(DataSourceError);

    expect(mockLoggingService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        type: LogType.QuotaNotRefunded,
        spaceId: args.spaceId,
        feature: 'sponsored_transactions',
      }),
    );
  });
});
