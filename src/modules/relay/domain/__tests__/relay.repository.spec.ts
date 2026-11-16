// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import type { IRelayApi } from '#/domain/interfaces/relay-api.interface';
import type { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { relayerBuilder } from '#/modules/chains/domain/entities/__tests__/relayer.builder';
import { relayBuilder } from '#/modules/relay/domain/entities/__tests__/relay.builder';
import { relayTaskStatusBuilder } from '#/modules/relay/domain/entities/__tests__/relay-task-status.builder';
import type { IRelayManager } from '#/modules/relay/domain/interfaces/relay-manager.interface';
import type { IRelayer } from '#/modules/relay/domain/interfaces/relayer.interface';
import { RelayRepository } from '#/modules/relay/domain/relay.repository';
import { rawify } from '#/validation/entities/raw.entity';

const mockRelayApi = vi.mocked({
  relay: vi.fn(),
  getTaskStatus: vi.fn(),
  getRelayCount: vi.fn(),
  setRelayCount: vi.fn(),
} as MockedObject<IRelayApi>);

const mockRelayer = vi.mocked({
  canRelay: vi.fn(),
  relay: vi.fn(),
  getRelaysRemaining: vi.fn(),
} as MockedObject<IRelayer>);

const mockRelayManager = vi.mocked({
  getRelayer: vi.fn(),
  getFreeRelayer: vi.fn(),
} as MockedObject<IRelayManager>);

const mockChainsRepository = {
  getChain: vi.fn(),
} as MockedObject<IChainsRepository>;

describe('RelayRepository', () => {
  let target: RelayRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    target = new RelayRepository(
      mockRelayManager,
      mockRelayApi,
      mockChainsRepository,
    );
  });

  describe('relay', () => {
    function relayArgs(
      chainId: string,
    ): Parameters<RelayRepository['relay']>[0] {
      return {
        version: faker.system.semver(),
        chainId,
        to: getAddress(faker.finance.ethereumAddress()),
        data: faker.string.hexadecimal() as Hex,
        gasLimit: null,
      };
    }

    it('should return the relayer result parsed against RelaySchema', async () => {
      const chain = chainBuilder()
        .with('relayer', relayerBuilder().build())
        .build();
      const relay = relayBuilder().build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockRelayManager.getRelayer.mockReturnValue(mockRelayer);
      mockRelayer.relay.mockResolvedValue(rawify(relay));

      const actual = await target.relay(relayArgs(chain.chainId));

      expect(actual).toStrictEqual(relay);
    });

    it('should throw if the relayer result does not match RelaySchema', async () => {
      const chain = chainBuilder()
        .with('relayer', relayerBuilder().build())
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockRelayManager.getRelayer.mockReturnValue(mockRelayer);
      mockRelayer.relay.mockResolvedValue(
        rawify({ unexpected: faker.string.sample() }),
      );

      await expect(target.relay(relayArgs(chain.chainId))).rejects.toThrow(
        ZodError,
      );
    });
  });

  describe('relayWithoutLimits', () => {
    function relayWithoutLimitsArgs(): Parameters<
      RelayRepository['relayWithoutLimits']
    >[0] {
      return {
        chainId: faker.string.numeric(),
        to: getAddress(faker.finance.ethereumAddress()),
        data: faker.string.hexadecimal() as Hex,
        safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
      };
    }

    it('should return the relay API result parsed against RelaySchema', async () => {
      const args = relayWithoutLimitsArgs();
      const relay = relayBuilder().build();
      mockRelayApi.relay.mockResolvedValue(rawify(relay));

      const actual = await target.relayWithoutLimits(args);

      expect(actual).toStrictEqual(relay);
      expect(mockRelayApi.relay).toHaveBeenCalledOnce();
      expect(mockRelayApi.relay).toHaveBeenCalledWith(args);
      expect(mockChainsRepository.getChain).not.toHaveBeenCalled();
      expect(mockRelayManager.getRelayer).not.toHaveBeenCalled();
      expect(mockRelayManager.getFreeRelayer).not.toHaveBeenCalled();
    });

    it('should throw if the relay API result does not match RelaySchema', async () => {
      mockRelayApi.relay.mockResolvedValue(
        rawify({ taskId: faker.number.int() }),
      );

      await expect(
        target.relayWithoutLimits(relayWithoutLimitsArgs()),
      ).rejects.toThrow(ZodError);
    });
  });

  describe('getRelaysRemaining', () => {
    it('should return the relays remaining from the free relayer of the chain', async () => {
      const chain = chainBuilder()
        .with('relayer', relayerBuilder().build())
        .build();
      const args = {
        chainId: chain.chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };
      const relaysRemaining = {
        remaining: faker.number.int({ min: 0, max: 5 }),
        limit: faker.number.int({ min: 5, max: 10 }),
      };
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockRelayManager.getFreeRelayer.mockReturnValue(mockRelayer);
      mockRelayer.getRelaysRemaining.mockResolvedValue(relaysRemaining);

      const actual = await target.getRelaysRemaining(args);

      expect(actual).toStrictEqual(relaysRemaining);
      expect(mockChainsRepository.getChain).toHaveBeenCalledWith(chain.chainId);
      expect(mockRelayManager.getFreeRelayer).toHaveBeenCalledWith(
        chain.relayer,
      );
      expect(mockRelayer.getRelaysRemaining).toHaveBeenCalledWith(args);
    });
  });

  describe('getTaskStatus', () => {
    it('should return the task status parsed against RelayTaskStatusSchema', async () => {
      const chainId = faker.string.numeric();
      const taskStatus = relayTaskStatusBuilder()
        .with('chainId', chainId)
        .build();
      mockRelayApi.getTaskStatus.mockResolvedValue(rawify(taskStatus));

      const actual = await target.getTaskStatus({
        chainId,
        taskId: taskStatus.id,
      });

      expect(actual).toStrictEqual(taskStatus);
      expect(mockRelayApi.getTaskStatus).toHaveBeenCalledWith({
        chainId,
        taskId: taskStatus.id,
      });
    });

    it('should throw if the datasource result does not match RelayTaskStatusSchema', async () => {
      const taskStatus = relayTaskStatusBuilder().build();
      mockRelayApi.getTaskStatus.mockResolvedValue(
        rawify({ ...taskStatus, status: faker.string.sample() }),
      );

      await expect(
        target.getTaskStatus({
          chainId: taskStatus.chainId,
          taskId: taskStatus.id,
        }),
      ).rejects.toThrow(ZodError);
    });
  });
});
