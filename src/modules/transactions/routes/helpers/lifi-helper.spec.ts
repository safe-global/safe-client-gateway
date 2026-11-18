// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '#/logging/logging.interface';
import type { IBridgeRepository } from '#/modules/bridge/domain/bridge.repository.interface';
import {
  bridgeDataStructBuilder,
  startBridgeTokensViaAcrossV3Encoder,
  swapAndStartBridgeTokensViaAcrossV3Encoder,
  swapDataStructBuilder,
  swapTokensSingleV3ERC20ToERC20Encoder,
} from '#/modules/bridge/domain/contracts/decoders/__tests__/across-v3-encoder.builder';
import { LiFiDecoder } from '#/modules/bridge/domain/contracts/decoders/lifi-decoder.helper';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { erc20TransferEncoder } from '#/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { LiFiHelper } from '#/modules/transactions/routes/helpers/lifi-helper';
import { TransactionFinder } from '#/modules/transactions/routes/helpers/transaction-finder.helper';

function bridgeEncoder(chainId: string): Hex {
  return startBridgeTokensViaAcrossV3Encoder()
    .with(
      'bridgeData',
      bridgeDataStructBuilder()
        .with(
          'destinationChainId',
          BigInt(faker.string.numeric({ exclude: chainId })),
        )
        .with('hasSourceSwaps', false)
        .build(),
    )
    .encode();
}

function swapEncoder(): Hex {
  return swapTokensSingleV3ERC20ToERC20Encoder()
    .with(
      'swapData',
      swapDataStructBuilder()
        .with('sendingAssetId', getAddress(faker.finance.ethereumAddress()))
        .with('receivingAssetId', getAddress(faker.finance.ethereumAddress()))
        .build(),
    )
    .encode();
}

function swapAndBridgeEncoder(chainId: string): Hex {
  return swapAndStartBridgeTokensViaAcrossV3Encoder()
    .with(
      'bridgeData',
      bridgeDataStructBuilder()
        .with(
          'destinationChainId',
          BigInt(faker.string.numeric({ exclude: chainId })),
        )
        .with('hasSourceSwaps', true)
        .build(),
    )
    .encode();
}

describe('LiFiHelper', () => {
  let target: LiFiHelper;

  const bridgeRepository = vi.mocked({
    getDiamondAddress: vi.fn(),
  } as MockedObject<IBridgeRepository>);
  const loggingService = vi.mocked({
    warn: vi.fn(),
  } as MockedObject<ILoggingService>);

  beforeEach(() => {
    vi.resetAllMocks();

    const multiSendDecoder = new MultiSendDecoder(loggingService);
    const transactionFinder = new TransactionFinder(multiSendDecoder);
    target = new LiFiHelper(
      new LiFiDecoder(),
      transactionFinder,
      bridgeRepository,
    );
  });

  describe.each([
    { name: 'getBridgeTransaction', encoder: bridgeEncoder } as const,
    { name: 'getSwapTransaction', encoder: swapEncoder } as const,
    {
      name: 'getSwapAndBridgeTransaction',
      encoder: swapAndBridgeEncoder,
    } as const,
  ])('$name', ({ name, encoder }) => {
    it('should return a transaction that calls the diamond address', async () => {
      const chainId = faker.string.numeric();
      const diamondAddress = getAddress(faker.finance.ethereumAddress());
      const transaction = multisigTransactionBuilder()
        .with('to', diamondAddress)
        .with('data', encoder(chainId))
        .build();
      bridgeRepository.getDiamondAddress.mockResolvedValue(diamondAddress);

      const result = await target[name]({ chainId, transaction });

      expect(result).toStrictEqual({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
      });
      expect(bridgeRepository.getDiamondAddress).toHaveBeenCalledTimes(1);
      expect(bridgeRepository.getDiamondAddress).toHaveBeenCalledWith(chainId);
    });

    it('should return the batched transaction that calls the diamond address', async () => {
      const chainId = faker.string.numeric();
      const diamondAddress = getAddress(faker.finance.ethereumAddress());
      const otherCall = {
        operation: 0,
        to: getAddress(faker.finance.ethereumAddress()),
        value: faker.number.bigInt(),
        data: encoder(chainId),
      };
      const diamondCall = {
        operation: 0,
        to: diamondAddress,
        value: faker.number.bigInt(),
        data: encoder(chainId),
      };
      const transaction = multisigTransactionBuilder()
        .with(
          'data',
          multiSendEncoder()
            .with(
              'transactions',
              multiSendTransactionsEncoder([otherCall, diamondCall]),
            )
            .encode(),
        )
        .build();
      bridgeRepository.getDiamondAddress.mockResolvedValue(diamondAddress);

      const result = await target[name]({ chainId, transaction });

      expect(result).toStrictEqual({
        to: diamondCall.to,
        data: diamondCall.data.toLowerCase(),
        value: diamondCall.value.toString(),
      });
    });

    it('should return null if the transaction calls another address', async () => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder()
        .with('data', encoder(chainId))
        .build();
      bridgeRepository.getDiamondAddress.mockResolvedValue(
        getAddress(faker.finance.ethereumAddress()),
      );

      const result = await target[name]({ chainId, transaction });

      expect(result).toBeNull();
      expect(bridgeRepository.getDiamondAddress).toHaveBeenCalledWith(chainId);
    });

    it('should return null without looking the diamond address up if the calldata is of another kind', async () => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder()
        .with('data', erc20TransferEncoder().encode())
        .build();

      const result = await target[name]({ chainId, transaction });

      expect(result).toBeNull();
      expect(bridgeRepository.getDiamondAddress).not.toHaveBeenCalled();
    });

    it('should return null without looking the diamond address up if no batched transaction is of the kind', async () => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder()
        .with(
          'data',
          multiSendEncoder()
            .with(
              'transactions',
              multiSendTransactionsEncoder([
                {
                  operation: 0,
                  to: getAddress(faker.finance.ethereumAddress()),
                  value: faker.number.bigInt(),
                  data: erc20TransferEncoder().encode(),
                },
              ]),
            )
            .encode(),
        )
        .build();

      const result = await target[name]({ chainId, transaction });

      expect(result).toBeNull();
      expect(bridgeRepository.getDiamondAddress).not.toHaveBeenCalled();
    });

    it.each([null, '0x' as const])(
      'should return null without looking the diamond address up if the calldata is %s',
      async (data) => {
        const chainId = faker.string.numeric();
        const transaction = multisigTransactionBuilder()
          .with('data', data)
          .build();

        const result = await target[name]({ chainId, transaction });

        expect(result).toBeNull();
        expect(bridgeRepository.getDiamondAddress).not.toHaveBeenCalled();
      },
    );

    it('should throw if the diamond address cannot be looked up', async () => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder()
        .with('data', encoder(chainId))
        .build();
      const error = new Error(faker.lorem.sentence());
      bridgeRepository.getDiamondAddress.mockRejectedValue(error);

      await expect(target[name]({ chainId, transaction })).rejects.toThrow(
        error,
      );
    });
  });
});
