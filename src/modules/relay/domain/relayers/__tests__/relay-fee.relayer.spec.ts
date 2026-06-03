// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Address, Hex } from 'viem';
import { getAddress } from 'viem';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import type { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import type { ITenderlySimulationApi } from '@/domain/interfaces/tenderly-simulation-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { RelaySimulationFailedError } from '@/modules/relay/domain/errors/relay-simulation-failed.error';
import { RelaySimulationIndeterminateError } from '@/modules/relay/domain/errors/relay-simulation-indeterminate.error';
import { RelayTxDeniedError } from '@/modules/relay/domain/errors/relay-tx-denied.error';
import { SafeTxHashMismatchError } from '@/modules/relay/domain/errors/safe-tx-hash-mismatch.error';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';
import type { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import { RelayFeeRelayer } from '../relay-fee.relayer';

const mockLoggingService = jest.mocked({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockRelayApi = jest.mocked({
  relay: jest.fn(),
  getRelayCount: jest.fn(),
  setRelayCount: jest.fn(),
} as jest.MockedObjectDeep<IRelayApi>);

const mockFeeServiceApi = jest.mocked({
  canRelay: jest.fn(),
} as jest.MockedObjectDeep<IFeeServiceApi>);

const mockTenderlySimulationApi = jest.mocked({
  simulate: jest.fn(),
} as jest.MockedObjectDeep<ITenderlySimulationApi>);

const mockRelayTransactionHelper = jest.mocked({
  decodeExecTransaction: jest.fn(),
  isValidDecodedExecTransaction: jest.fn(),
  isValidExecTransactionCall: jest.fn(),
  isSafeTxHashValid: jest.fn(),
  isValidCreateProxyWithNonceCall: jest.fn(),
  isOfficialProxyFactoryDeployment: jest.fn(),
} as jest.MockedObjectDeep<RelayTransactionHelper>);

function fakeSafeTxHash(): Hex {
  return faker.string.hexadecimal({ length: 64, casing: 'lower' }) as Hex;
}

function fakeAddress(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

describe('RelayFeeRelayer', () => {
  let target: RelayFeeRelayer;
  let fakeConfigurationService: FakeConfigurationService;
  let enabledChainId: string;

  beforeEach(() => {
    jest.resetAllMocks();

    fakeConfigurationService = new FakeConfigurationService();
    enabledChainId = faker.string.numeric();
    fakeConfigurationService.set('relay.fee', {
      enabledChainIds: [enabledChainId],
      baseUri: faker.internet.url({ appendSlash: false }),
    });
    fakeConfigurationService.set('relay.simulation', {
      enabledChainIds: [],
    });

    target = new RelayFeeRelayer(
      mockLoggingService,
      fakeConfigurationService,
      mockRelayApi,
      mockFeeServiceApi,
      mockTenderlySimulationApi,
      mockRelayTransactionHelper,
    );
  });

  describe('canRelay', () => {
    it('should return false for chains not enabled for relay-fee', async () => {
      const result = await target.canRelay({
        chainId: faker.string.numeric({ length: 5 }),
        address: fakeAddress(),
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
    });

    it('should return false when no safeTxHash is provided', async () => {
      const result = await target.canRelay({
        chainId: enabledChainId,
        address: fakeAddress(),
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
    });

    it('should return true when FeeService approves', async () => {
      const safeTxHash = fakeSafeTxHash();
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.canRelay({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash,
      });

      expect(result).toEqual({ result: true, currentCount: 0, limit: 1 });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
    });

    it('should return false when FeeService denies', async () => {
      const safeTxHash = fakeSafeTxHash();
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      const result = await target.canRelay({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash,
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('relay-fee canRelay denied'),
        }),
      );
    });
  });

  describe('relay', () => {
    // Shared fake decoded object for execTransaction tests
    const fakeDecoded = {
      to: '0x0000000000000000000000000000000000000001' as const,
      value: BigInt(0),
      data: '0x' as const,
      operation: 0,
      safeTxGas: BigInt(0),
      baseGas: BigInt(0),
      gasPrice: BigInt(0),
      gasToken: '0x0000000000000000000000000000000000000000' as const,
      refundReceiver: '0x0000000000000000000000000000000000000000' as const,
    };

    it('should throw RelayTxDeniedError when no safeTxHash is provided for execTransaction', async () => {
      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(
        fakeDecoded,
      );
      mockRelayTransactionHelper.isValidDecodedExecTransaction.mockReturnValue(
        true,
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
        }),
      ).rejects.toThrow(RelayTxDeniedError);

      expect(
        mockRelayTransactionHelper.isSafeTxHashValid,
      ).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it('should relay when isSafeTxHashValid returns true and fee service approves', async () => {
      const safeAddress = fakeAddress();
      const safeTxHash = fakeSafeTxHash();
      const taskId = faker.string.uuid();

      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(
        fakeDecoded,
      );
      mockRelayTransactionHelper.isValidDecodedExecTransaction.mockReturnValue(
        true,
      );
      mockRelayTransactionHelper.isSafeTxHashValid.mockResolvedValue(true);
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: safeAddress,
        data: '0x' as Hex,
        gasLimit: null,
        safeTxHash,
      });

      expect(result).toEqual({ taskId });
      expect(mockRelayTransactionHelper.isSafeTxHashValid).toHaveBeenCalledWith(
        {
          chainId: enabledChainId,
          safeAddress,
          decoded: fakeDecoded,
          safeTxHash,
        },
      );
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
      expect(mockRelayApi.relay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        to: safeAddress,
        data: '0x',
      });
    });

    it('should throw SafeTxHashMismatchError when isSafeTxHashValid returns false', async () => {
      const safeTxHash = fakeSafeTxHash();

      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(
        fakeDecoded,
      );
      mockRelayTransactionHelper.isValidDecodedExecTransaction.mockReturnValue(
        true,
      );
      mockRelayTransactionHelper.isSafeTxHashValid.mockResolvedValue(false);

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash,
        }),
      ).rejects.toThrow(SafeTxHashMismatchError);

      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it('should throw RelayTxDeniedError when fee service denies after hash validation passes', async () => {
      const safeAddress = fakeAddress();
      const safeTxHash = fakeSafeTxHash();

      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(
        fakeDecoded,
      );
      mockRelayTransactionHelper.isValidDecodedExecTransaction.mockReturnValue(
        true,
      );
      mockRelayTransactionHelper.isSafeTxHashValid.mockResolvedValue(true);
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: safeAddress,
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash,
        }),
      ).rejects.toThrow(RelayTxDeniedError);

      expect(mockRelayApi.relay).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('fee service rejected'),
        }),
      );
    });

    it('should relay a Safe creation when factory is official', async () => {
      const safeAddress = fakeAddress();
      const safeTxHash = fakeSafeTxHash();
      const taskId = faker.string.uuid();

      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(null);
      mockRelayTransactionHelper.isValidCreateProxyWithNonceCall.mockReturnValue(
        true,
      );
      mockRelayTransactionHelper.isOfficialProxyFactoryDeployment.mockReturnValue(
        true,
      );
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: safeAddress,
        data: '0x' as Hex,
        gasLimit: null,
        safeTxHash,
      });

      expect(result).toEqual({ taskId });
      expect(
        mockRelayTransactionHelper.isSafeTxHashValid,
      ).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).toHaveBeenCalled();
    });

    it('should relay a Safe creation without safeTxHash when factory is official', async () => {
      const taskId = faker.string.uuid();

      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(null);
      mockRelayTransactionHelper.isValidCreateProxyWithNonceCall.mockReturnValue(
        true,
      );
      mockRelayTransactionHelper.isOfficialProxyFactoryDeployment.mockReturnValue(
        true,
      );
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: fakeAddress(),
        data: '0x' as Hex,
        gasLimit: null,
      });

      expect(result).toEqual({ taskId });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).toHaveBeenCalled();
    });

    it('should throw UnofficialProxyFactoryError for unofficial proxy factory', async () => {
      const to = fakeAddress();

      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(null);
      mockRelayTransactionHelper.isValidCreateProxyWithNonceCall.mockReturnValue(
        true,
      );
      mockRelayTransactionHelper.isOfficialProxyFactoryDeployment.mockReturnValue(
        false,
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to,
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        }),
      ).rejects.toThrow(UnofficialProxyFactoryError);

      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('unofficial proxy factory'),
        }),
      );
    });

    it('should throw RelayTxDeniedError with invalid-execTransaction message when decoded but isValidDecodedExecTransaction returns false', async () => {
      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(
        fakeDecoded,
      );
      mockRelayTransactionHelper.isValidDecodedExecTransaction.mockReturnValue(
        false,
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        }),
      ).rejects.toThrow(RelayTxDeniedError);

      expect(
        mockRelayTransactionHelper.isValidCreateProxyWithNonceCall,
      ).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('invalid execTransaction'),
        }),
      );
    });

    it('should throw RelayTxDeniedError for unrecognised transaction type', async () => {
      mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(null);
      mockRelayTransactionHelper.isValidCreateProxyWithNonceCall.mockReturnValue(
        false,
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        }),
      ).rejects.toThrow(RelayTxDeniedError);

      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    describe('simulation gate', () => {
      const simulationChainId = '137';

      function configureSimulationEnabled(chainIds: Array<string>): void {
        fakeConfigurationService.set('relay.simulation', {
          enabledChainIds: chainIds,
        });
        target = new RelayFeeRelayer(
          mockLoggingService,
          fakeConfigurationService,
          mockRelayApi,
          mockFeeServiceApi,
          mockTenderlySimulationApi,
          mockRelayTransactionHelper,
        );
      }

      function arrangeValidExecTransaction(): void {
        mockRelayTransactionHelper.decodeExecTransaction.mockReturnValue(
          fakeDecoded,
        );
        mockRelayTransactionHelper.isValidDecodedExecTransaction.mockReturnValue(
          true,
        );
        mockRelayTransactionHelper.isSafeTxHashValid.mockResolvedValue(true);
        mockFeeServiceApi.canRelay.mockResolvedValue({ canRelay: true });
      }

      it('skips simulation when chainId is not in relay.simulation.enabledChainIds', async () => {
        fakeConfigurationService.set('relay.fee', {
          enabledChainIds: [simulationChainId],
          baseUri: faker.internet.url({ appendSlash: false }),
        });
        configureSimulationEnabled([]); // empty -> gate disabled for every chain
        arrangeValidExecTransaction();
        const taskId = faker.string.uuid();
        mockRelayApi.relay.mockResolvedValueOnce({ taskId });

        const result = await target.relay({
          version: '1.3.0',
          chainId: simulationChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        });

        expect(result).toEqual({ taskId });
        expect(mockTenderlySimulationApi.simulate).not.toHaveBeenCalled();
        expect(mockRelayApi.relay).toHaveBeenCalledTimes(1);
      });

      it('runs simulation and relays when the simulation succeeds', async () => {
        fakeConfigurationService.set('relay.fee', {
          enabledChainIds: [simulationChainId],
          baseUri: faker.internet.url({ appendSlash: false }),
        });
        configureSimulationEnabled([simulationChainId]);
        arrangeValidExecTransaction();
        mockTenderlySimulationApi.simulate.mockResolvedValueOnce({
          status: 'success',
        });
        const safeAddress = fakeAddress();
        const taskId = faker.string.uuid();
        mockRelayApi.relay.mockResolvedValueOnce({ taskId });

        const result = await target.relay({
          version: '1.3.0',
          chainId: simulationChainId,
          to: safeAddress,
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        });

        expect(result).toEqual({ taskId });
        expect(mockTenderlySimulationApi.simulate).toHaveBeenCalledWith({
          chainId: simulationChainId,
          from: '0x000000000000000000000000000000000000dEaD',
          to: safeAddress,
          data: '0x',
        });
        expect(mockRelayApi.relay).toHaveBeenCalledTimes(1);
      });

      it('throws RelaySimulationFailedError and never relays when the simulation fails', async () => {
        fakeConfigurationService.set('relay.fee', {
          enabledChainIds: [simulationChainId],
          baseUri: faker.internet.url({ appendSlash: false }),
        });
        configureSimulationEnabled([simulationChainId]);
        arrangeValidExecTransaction();
        mockTenderlySimulationApi.simulate.mockResolvedValueOnce({
          status: 'failed',
          reason: "Reverted with reason string: 'GS013'",
        });
        const safeTxHash = fakeSafeTxHash();

        await expect(
          target.relay({
            version: '1.3.0',
            chainId: simulationChainId,
            to: fakeAddress(),
            data: '0x' as Hex,
            gasLimit: null,
            safeTxHash,
          }),
        ).rejects.toThrow(RelaySimulationFailedError);

        expect(mockRelayApi.relay).not.toHaveBeenCalled();
        expect(mockLoggingService.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining(
              `simulation failed (Reverted with reason string: 'GS013') for safeTxHash ${safeTxHash}`,
            ),
          }),
        );
      });

      it('throws RelaySimulationIndeterminateError when simulation is indeterminate and the user has not acknowledged it', async () => {
        fakeConfigurationService.set('relay.fee', {
          enabledChainIds: [simulationChainId],
          baseUri: faker.internet.url({ appendSlash: false }),
        });
        configureSimulationEnabled([simulationChainId]);
        arrangeValidExecTransaction();
        mockTenderlySimulationApi.simulate.mockResolvedValueOnce({
          status: 'indeterminate',
          reason: 'Simulation could not be completed',
        });
        const safeTxHash = fakeSafeTxHash();

        await expect(
          target.relay({
            version: '1.3.0',
            chainId: simulationChainId,
            to: fakeAddress(),
            data: '0x' as Hex,
            gasLimit: null,
            safeTxHash,
          }),
        ).rejects.toThrow(RelaySimulationIndeterminateError);

        expect(mockRelayApi.relay).not.toHaveBeenCalled();
        expect(mockLoggingService.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining(
              `simulation indeterminate (Simulation could not be completed) for safeTxHash ${safeTxHash}`,
            ),
          }),
        );
      });

      it('relays despite an indeterminate simulation when the user has acknowledged it', async () => {
        fakeConfigurationService.set('relay.fee', {
          enabledChainIds: [simulationChainId],
          baseUri: faker.internet.url({ appendSlash: false }),
        });
        configureSimulationEnabled([simulationChainId]);
        arrangeValidExecTransaction();
        mockTenderlySimulationApi.simulate.mockResolvedValueOnce({
          status: 'indeterminate',
          reason: 'Simulation could not be completed',
        });
        const taskId = faker.string.uuid();
        mockRelayApi.relay.mockResolvedValueOnce({ taskId });
        const safeTxHash = fakeSafeTxHash();

        const result = await target.relay({
          version: '1.3.0',
          chainId: simulationChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash,
          acceptUnverifiedSimulation: true,
        });

        expect(result).toEqual({ taskId });
        expect(mockRelayApi.relay).toHaveBeenCalledTimes(1);
        expect(mockLoggingService.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('user override'),
          }),
        );
      });

      it('still throws RelaySimulationFailedError on the override path when the second simulation confirms a revert', async () => {
        fakeConfigurationService.set('relay.fee', {
          enabledChainIds: [simulationChainId],
          baseUri: faker.internet.url({ appendSlash: false }),
        });
        configureSimulationEnabled([simulationChainId]);
        arrangeValidExecTransaction();
        mockTenderlySimulationApi.simulate.mockResolvedValueOnce({
          status: 'failed',
          reason: "Reverted with reason string: 'GS013'",
        });

        await expect(
          target.relay({
            version: '1.3.0',
            chainId: simulationChainId,
            to: fakeAddress(),
            data: '0x' as Hex,
            gasLimit: null,
            safeTxHash: fakeSafeTxHash(),
            acceptUnverifiedSimulation: true,
          }),
        ).rejects.toThrow(RelaySimulationFailedError);

        expect(mockRelayApi.relay).not.toHaveBeenCalled();
      });
    });
  });

  describe('getRelaysRemaining', () => {
    it('should return optimistic 1 when no safeTxHash is provided on an enabled chain', async () => {
      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: fakeAddress(),
      });

      expect(result).toEqual({ remaining: 1, limit: 1 });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
    });

    it('should return 0 for chains not enabled for relay-fee', async () => {
      const result = await target.getRelaysRemaining({
        chainId: faker.string.numeric({ length: 5 }),
        address: fakeAddress(),
        safeTxHash: fakeSafeTxHash(),
      });

      expect(result).toEqual({ remaining: 0, limit: 0 });
    });

    it('should return 1 remaining for enabled chains when FeeService approves', async () => {
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash: fakeSafeTxHash(),
      });

      expect(result).toEqual({ remaining: 1, limit: 1 });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledTimes(1);
    });

    it('should pass safeTxHash to Fee Service when provided', async () => {
      const safeTxHash = fakeSafeTxHash();
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash,
      });

      expect(result).toEqual({ remaining: 1, limit: 1 });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
    });

    it('should return 0 remaining for enabled chains when Fee Service denies', async () => {
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash: fakeSafeTxHash(),
      });

      expect(result).toEqual({ remaining: 0, limit: 0 });
    });
  });
});
