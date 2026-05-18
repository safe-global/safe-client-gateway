// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import type { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { SafeRepository } from '@/modules/safe/domain/safe.repository';
import type { SpaceQueueTransaction } from '@/modules/spaces/datasources/entities/space-queue-transaction.entity';
import type { ISpaceQueueApi } from '@/modules/spaces/datasources/space-queue-api.service';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { SpaceTransactionsService } from '@/modules/spaces/routes/space-transactions.service';
import { ConflictType } from '@/modules/transactions/routes/entities/conflict-type.entity';
import { TransactionQueuedItem } from '@/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';
import type { MultisigTransactionMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import type { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';

const addr = (): Address => getAddress(faker.finance.ethereumAddress());
const hex = (bytes: number): `0x${string}` =>
  `0x${faker.string.hexadecimal({ length: bytes * 2, casing: 'lower', prefix: '' })}` as `0x${string}`;

const spaceSafesRepositoryMock = {
  findBySpaceId: jest.fn(),
} as unknown as jest.Mocked<ISpaceSafesRepository>;

const spaceQueueApiMock = {
  getQueuedTransactions: jest.fn(),
} as unknown as jest.Mocked<ISpaceQueueApi>;

const safeRepositoryMock = {
  getSafe: jest.fn(),
} as unknown as jest.Mocked<
  Pick<SafeRepository, 'getSafe'>
> as jest.Mocked<SafeRepository>;

const dataDecoderRepositoryMock = {
  getTransactionDataDecoded: jest.fn(),
} as unknown as jest.Mocked<IDataDecoderRepository>;

const multisigTransactionMapperMock = {
  mapTransaction: jest.fn(),
} as unknown as jest.Mocked<MultisigTransactionMapper>;

type UpstreamOverrides = Partial<SpaceQueueTransaction>;

const upstreamTxBuilder = (
  chainId: string,
  safe: Address,
  overrides: UpstreamOverrides = {},
): SpaceQueueTransaction => ({
  chainId,
  safe,
  safeTxHash: hex(32),
  nonce: faker.number.int({ min: 1, max: 200 }),
  to: addr(),
  value: '0',
  data: hex(4),
  operation: Operation.CALL,
  safeTxGas: 0,
  baseGas: 0,
  gasPrice: '0',
  gasToken: null,
  refundReceiver: null,
  proposer: addr(),
  proposedByDelegate: null,
  failed: null,
  notes: null,
  originName: null,
  originUrl: null,
  txHash: null,
  created: faker.date.past(),
  modified: faker.date.recent(),
  confirmations: [],
  ...overrides,
});

const upstreamPage = (
  results: Array<SpaceQueueTransaction>,
  count: number | null = results.length,
): Page<SpaceQueueTransaction> => ({
  count,
  next: null,
  previous: null,
  results,
});

const routeUrl = (offset = 0, limit = 20): URL =>
  new URL(
    `http://localhost/v1/spaces/1/transactions/queued?cursor=limit%3D${limit}%26offset%3D${offset}`,
  );

describe('SpaceTransactionsService', () => {
  let service: SpaceTransactionsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SpaceTransactionsService(
      spaceSafesRepositoryMock,
      spaceQueueApiMock,
      safeRepositoryMock,
      dataDecoderRepositoryMock,
      multisigTransactionMapperMock,
    );
  });

  describe('getTransactionQueue', () => {
    it('returns an empty page without calling the upstream when the space has no safes', async () => {
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([]);

      const result = await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      expect(result).toEqual({
        count: 0,
        next: null,
        previous: null,
        results: [],
      });
      expect(spaceQueueApiMock.getQueuedTransactions).not.toHaveBeenCalled();
      expect(safeRepositoryMock.getSafe).not.toHaveBeenCalled();
    });

    it('forwards space safes and pagination data to the queue API', async () => {
      const safeA = addr();
      const safeB = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeA },
        { chainId: '11155111', address: safeB },
      ]);
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([]),
      );
      safeRepositoryMock.getSafe.mockResolvedValue(safeBuilder().build());

      await service.getTransactionQueue({
        spaceId: 42,
        routeUrl: routeUrl(40, 10),
        paginationData: new PaginationData(10, 40),
      });

      expect(spaceQueueApiMock.getQueuedTransactions).toHaveBeenCalledWith({
        safes: [
          { chainId: '1', address: safeA },
          { chainId: '11155111', address: safeB },
        ],
        limit: 10,
        offset: 40,
      });
    });

    it('loads the Safe entity for each (chainId, address) pair', async () => {
      const safeA = addr();
      const safeB = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeA },
        { chainId: '137', address: safeB },
      ]);
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([]),
      );
      safeRepositoryMock.getSafe.mockResolvedValue(safeBuilder().build());

      await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      expect(safeRepositoryMock.getSafe).toHaveBeenCalledTimes(2);
      expect(safeRepositoryMock.getSafe).toHaveBeenCalledWith({
        chainId: '1',
        address: safeA,
      });
      expect(safeRepositoryMock.getSafe).toHaveBeenCalledWith({
        chainId: '137',
        address: safeB,
      });
    });

    it('wraps each mapped transaction in a TransactionQueuedItem with ConflictType.None', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ]);
      const safe = safeBuilder().with('address', safeAddress).build();
      safeRepositoryMock.getSafe.mockResolvedValue(safe);
      const upstream = upstreamTxBuilder('1', safeAddress);
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([upstream]),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      const mapped = { id: 'multisig_xxx_yyy' } as never;
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(mapped);

      const result = await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toBeInstanceOf(TransactionQueuedItem);
      expect(result.results[0]).toMatchObject({
        transaction: mapped,
        conflictType: ConflictType.None,
      });
    });

    it('transforms upstream fields into the domain MultisigTransaction shape', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ]);
      const safe = safeBuilder()
        .with('address', safeAddress)
        .with('threshold', 3)
        .build();
      safeRepositoryMock.getSafe.mockResolvedValue(safe);

      const upstreamTxHash = hex(32);
      const upstreamSafeTxHash = hex(32);
      const created = new Date('2024-01-01T00:00:00Z');
      const modified = new Date('2024-01-02T00:00:00Z');
      const proposer = addr();
      const upstream = upstreamTxBuilder('1', safeAddress, {
        safeTxHash: upstreamSafeTxHash,
        txHash: upstreamTxHash,
        created,
        modified,
        proposer,
        nonce: 7,
        value: '1000',
        originName: 'Safe App',
        originUrl: 'https://example.org/app',
      });
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([upstream]),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      const passedTx =
        multisigTransactionMapperMock.mapTransaction.mock.calls[0][1];

      expect(passedTx).toMatchObject({
        safe: safeAddress,
        safeTxHash: upstreamSafeTxHash,
        transactionHash: upstreamTxHash,
        submissionDate: created,
        modified,
        nonce: 7,
        value: '1000',
        proposer,
        confirmationsRequired: 3,
        isExecuted: false,
        isSuccessful: null,
        executionDate: null,
        blockNumber: null,
        executor: null,
        ethGasPrice: null,
        gasUsed: null,
        fee: null,
        payment: null,
        signatures: null,
        trusted: true,
        origin: JSON.stringify({
          name: 'Safe App',
          url: 'https://example.org/app',
        }),
      });
    });

    it('emits origin: null when the upstream has no originName', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ]);
      safeRepositoryMock.getSafe.mockResolvedValue(
        safeBuilder().with('address', safeAddress).build(),
      );
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([
          upstreamTxBuilder('1', safeAddress, {
            originName: null,
            originUrl: null,
          }),
        ]),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      const passedTx =
        multisigTransactionMapperMock.mapTransaction.mock.calls[0][1];
      expect(passedTx).toMatchObject({ origin: null });
    });

    it('transforms upstream confirmations (created → submissionDate, no transactionHash)', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ]);
      safeRepositoryMock.getSafe.mockResolvedValue(
        safeBuilder().with('address', safeAddress).build(),
      );
      const owner = addr();
      const sig = hex(65);
      const confCreated = new Date('2024-03-01T00:00:00Z');
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([
          upstreamTxBuilder('1', safeAddress, {
            confirmations: [
              {
                owner,
                signature: sig,
                signatureType: SignatureType.Eoa,
                created: confCreated,
              },
            ],
          }),
        ]),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      const passedTx =
        multisigTransactionMapperMock.mapTransaction.mock.calls[0][1];
      expect(passedTx.confirmations).toEqual([
        {
          owner,
          signature: sig,
          signatureType: SignatureType.Eoa,
          submissionDate: confCreated,
          transactionHash: null,
        },
      ]);
    });

    it('defaults confirmations to an empty array when the upstream sends null', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ]);
      safeRepositoryMock.getSafe.mockResolvedValue(
        safeBuilder().with('address', safeAddress).build(),
      );
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([
          upstreamTxBuilder('1', safeAddress, {
            confirmations: null as never,
          }),
        ]),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      const passedTx =
        multisigTransactionMapperMock.mapTransaction.mock.calls[0][1];
      expect(passedTx.confirmations).toEqual([]);
    });

    it('pairs each tx with the Safe matching its (chainId, address)', async () => {
      const safeA = addr();
      const safeB = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeA },
        { chainId: '137', address: safeB },
      ]);
      const safeAEntity = safeBuilder()
        .with('address', safeA)
        .with('threshold', 2)
        .build();
      const safeBEntity = safeBuilder()
        .with('address', safeB)
        .with('threshold', 5)
        .build();
      safeRepositoryMock.getSafe.mockImplementation(async ({ address }) =>
        address === safeA ? safeAEntity : safeBEntity,
      );
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([
          upstreamTxBuilder('1', safeA),
          upstreamTxBuilder('137', safeB),
        ]),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      const calls = multisigTransactionMapperMock.mapTransaction.mock.calls;
      expect(calls[0][0]).toBe('1');
      expect(calls[0][1].confirmationsRequired).toBe(2);
      expect(calls[0][2]).toBe(safeAEntity);
      expect(calls[1][0]).toBe('137');
      expect(calls[1][1].confirmationsRequired).toBe(5);
      expect(calls[1][2]).toBe(safeBEntity);
    });

    it('decodes data with the chainId of each tx and the transformed payload', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '11155111', address: safeAddress },
      ]);
      safeRepositoryMock.getSafe.mockResolvedValue(
        safeBuilder().with('address', safeAddress).build(),
      );
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([upstreamTxBuilder('11155111', safeAddress)]),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      expect(
        dataDecoderRepositoryMock.getTransactionDataDecoded,
      ).toHaveBeenCalledTimes(1);
      const [decodedArgs] =
        dataDecoderRepositoryMock.getTransactionDataDecoded.mock.calls[0];
      expect(decodedArgs.chainId).toBe('11155111');
      expect(decodedArgs.transaction).toMatchObject({
        safe: safeAddress,
        isExecuted: false,
      });
    });

    it('forwards the decoded data to the mapper', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ]);
      safeRepositoryMock.getSafe.mockResolvedValue(
        safeBuilder().with('address', safeAddress).build(),
      );
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([upstreamTxBuilder('1', safeAddress)]),
      );
      const decoded = { method: 'transfer' } as never;
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        decoded,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(),
        paginationData: new PaginationData(20, 0),
      });

      expect(
        multisigTransactionMapperMock.mapTransaction.mock.calls[0][3],
      ).toBe(decoded);
    });

    it('builds cursor-based next/previous URLs from the page count and route url', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ]);
      safeRepositoryMock.getSafe.mockResolvedValue(
        safeBuilder().with('address', safeAddress).build(),
      );
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([upstreamTxBuilder('1', safeAddress)], 100),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      const result = await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(20, 10),
        paginationData: new PaginationData(10, 20),
      });

      expect(result.count).toBe(100);
      const decode = (url: string | null): string | null =>
        url ? decodeURIComponent(url) : url;
      expect(decode(result.previous)).toEqual(
        expect.stringContaining('cursor=limit=10&offset=10'),
      );
      expect(decode(result.next)).toEqual(
        expect.stringContaining('cursor=limit=10&offset=30'),
      );
    });

    it('returns previous: null on the first page (offset 0)', async () => {
      const safeAddress = addr();
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ]);
      safeRepositoryMock.getSafe.mockResolvedValue(
        safeBuilder().with('address', safeAddress).build(),
      );
      spaceQueueApiMock.getQueuedTransactions.mockResolvedValue(
        upstreamPage([upstreamTxBuilder('1', safeAddress)], 5),
      );
      dataDecoderRepositoryMock.getTransactionDataDecoded.mockResolvedValue(
        null,
      );
      multisigTransactionMapperMock.mapTransaction.mockResolvedValue(
        {} as never,
      );

      const result = await service.getTransactionQueue({
        spaceId: 1,
        routeUrl: routeUrl(0, 20),
        paginationData: new PaginationData(20, 0),
      });

      expect(result.previous).toBeNull();
      expect(result.next).toBeNull();
    });

    it('propagates errors raised by the queue API', async () => {
      spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: addr() },
      ]);
      const err = new Error('upstream down');
      spaceQueueApiMock.getQueuedTransactions.mockRejectedValue(err);

      await expect(
        service.getTransactionQueue({
          spaceId: 1,
          routeUrl: routeUrl(),
          paginationData: new PaginationData(20, 0),
        }),
      ).rejects.toBe(err);

      expect(safeRepositoryMock.getSafe).not.toHaveBeenCalled();
    });
  });
});
