// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import type { ILoggingService } from '#/logging/logging.interface';
import type { IContractsRepository } from '#/modules/contracts/domain/contracts.repository.interface';
import type { IDataDecoderRepository } from '#/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import { dataDecodedBuilder } from '#/modules/data-decoder/domain/v2/entities/__tests__/data-decoded.builder';
import type { DataDecoded } from '#/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { Transaction } from '#/modules/safe/domain/entities/transaction.entity';
import type { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import type { MultisigTransactionMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import { QueuedItemsMapper } from '#/modules/transactions/routes/mappers/queued-items/queued-items.mapper';
import type { AddressInfoHelper } from '#/routes/common/address-info/address-info.helper';
import { AddressLookups } from '#/routes/common/address-info/address-lookups';

const mockDataDecoderRepository = {
  getTransactionDataDecoded: vi.fn(),
} as MockedObject<IDataDecoderRepository>;

const mockMultisigTransactionMapper = {
  mapTransaction: vi.fn(),
} as unknown as MockedObject<MultisigTransactionMapper>;

const mockAddressInfoHelper = {
  createLookups: vi.fn(),
} as MockedObject<AddressInfoHelper>;

describe('QueuedItemsMapper', () => {
  let target: QueuedItemsMapper;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new QueuedItemsMapper(
      mockDataDecoderRepository,
      mockMultisigTransactionMapper,
      mockAddressInfoHelper,
    );
  });

  describe('getQueuedItems', () => {
    it('decodes each transaction once and maps every group with the same address lookups', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const [conflicting, replacement, following] = [0, 0, 1].map((offset) =>
        multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce + offset)
          .build(),
      );
      const transactions = [conflicting, replacement, following];
      const dataDecoded = transactions.map(() => dataDecodedBuilder().build());
      const dataDecodedByTransaction = new Map<Transaction, DataDecoded>(
        transactions.map((transaction, index) => [
          transaction,
          dataDecoded[index],
        ]),
      );
      mockDataDecoderRepository.getTransactionDataDecoded.mockImplementation(
        ({ transaction }) =>
          Promise.resolve(dataDecodedByTransaction.get(transaction) ?? null),
      );
      const addressLookups = new AddressLookups(
        chainId,
        vi.mocked({ getToken: vi.fn() } as MockedObject<ITokenRepository>),
        vi.mocked({
          getContract: vi.fn(),
        } as MockedObject<IContractsRepository>),
        vi.mocked({ debug: vi.fn() } as MockedObject<ILoggingService>),
      );
      mockAddressInfoHelper.createLookups.mockReturnValue(addressLookups);

      await target.getQueuedItems(
        pageBuilder<MultisigTransaction>()
          .with('next', null)
          .with('previous', null)
          .with('results', transactions)
          .build(),
        safe,
        chainId,
        null,
        null,
      );

      expect(
        mockDataDecoderRepository.getTransactionDataDecoded,
      ).toHaveBeenCalledTimes(transactions.length);
      expect(mockAddressInfoHelper.createLookups).toHaveBeenCalledTimes(1);
      expect(mockAddressInfoHelper.createLookups).toHaveBeenCalledWith(chainId);
      for (const [index, transaction] of transactions.entries()) {
        expect(
          mockDataDecoderRepository.getTransactionDataDecoded,
        ).toHaveBeenCalledWith({ chainId, transaction });
        expect(
          mockMultisigTransactionMapper.mapTransaction,
        ).toHaveBeenCalledWith(
          chainId,
          transaction,
          safe,
          dataDecoded[index],
          addressLookups,
        );
      }
    });
  });
});
