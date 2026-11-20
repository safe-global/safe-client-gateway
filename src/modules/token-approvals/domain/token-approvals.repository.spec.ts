// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  type Address,
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  getAddress,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import type { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import type { ILoggingService } from '#/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { erc20ApproveEncoder } from '#/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import { moduleTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/module-transaction.builder';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import type { ModuleTransaction } from '#/modules/safe/domain/entities/module-transaction.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import { TokenApprovalCallsHelper } from '#/modules/token-approvals/domain/helpers/token-approval-calls.helper';
import {
  HISTORY_PAGE_SIZE,
  MULTICALL3_ADDRESS,
} from '#/modules/token-approvals/domain/token-approvals.constants';
import { TokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository';

const loggingService = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const safeRepository = {
  getMultisigTransactions: vi.fn(),
  getModuleTransactions: vi.fn(),
} as unknown as MockedObject<ISafeRepository>;

const client = {
  getTransactionReceipt: vi.fn(),
  multicall: vi.fn(),
} as unknown as MockedObject<PublicClient>;

const blockchainApiManager = {
  getApi: vi.fn(),
} as unknown as MockedObject<IBlockchainApiManager>;

function fakeAddress(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

/** An executed multisig transaction that approves `spender` on token `to`. */
function approveTransaction(args: {
  tokenAddress: Address;
  spender: Address;
}): MultisigTransaction {
  return multisigTransactionBuilder()
    .with('to', args.tokenAddress)
    .with('data', erc20ApproveEncoder().with('spender', args.spender).encode())
    .with('operation', Operation.CALL)
    .with('isSuccessful', true)
    .build();
}

function receiptWithApproval(args: {
  tokenAddress: Address;
  owner: Address;
  spender: Address;
}): TransactionReceipt {
  return {
    logs: [
      {
        address: args.tokenAddress,
        topics: encodeEventTopics({
          abi: erc20Abi,
          eventName: 'Approval',
          args: { owner: args.owner, spender: args.spender },
        }),
        data: encodeAbiParameters(
          [{ type: 'uint256' }],
          [faker.number.bigInt()],
        ),
      },
    ],
  } as unknown as TransactionReceipt;
}

describe('TokenApprovalsRepository', () => {
  const chainId = faker.string.numeric();
  const safeAddress = fakeAddress();
  const maxPages = 3;
  let target: TokenApprovalsRepository;

  function mockHistory(args: {
    multisig?: Array<MultisigTransaction>;
    module?: Array<ModuleTransaction>;
  }): void {
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>()
        .with('count', args.multisig?.length ?? 0)
        .with('results', args.multisig ?? [])
        .build(),
    );
    safeRepository.getModuleTransactions.mockResolvedValue(
      pageBuilder<ModuleTransaction>()
        .with('count', args.module?.length ?? 0)
        .with('results', args.module ?? [])
        .build(),
    );
  }

  /** Answers every `allowance` read with `allowance`, unless the token is in `failing`. */
  function mockAllowances(
    allowance: bigint,
    failing: Array<Address> = [],
  ): void {
    client.multicall.mockImplementation(({ contracts }) =>
      Promise.resolve(
        contracts.map((contract) =>
          failing.includes((contract as { address: Address }).address)
            ? { status: 'failure', error: new Error(), result: undefined }
            : { status: 'success', result: allowance },
        ),
      ),
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    const configurationService = new FakeConfigurationService();
    configurationService.set('tokenApprovals.history.maxPages', maxPages);
    configurationService.set('tokenApprovals.history.concurrency', 2);
    configurationService.set('tokenApprovals.receipts.concurrency', 2);
    blockchainApiManager.getApi.mockResolvedValue(client);
    target = new TokenApprovalsRepository(
      configurationService,
      safeRepository,
      blockchainApiManager,
      new TokenApprovalCallsHelper(
        new MultiSendDecoder(loggingService),
        loggingService,
      ),
    );
  });

  it('returns the live approvals found in multisig and module transactions', async () => {
    const multisigApproval = {
      tokenAddress: fakeAddress(),
      spender: fakeAddress(),
    };
    const moduleApproval = {
      tokenAddress: fakeAddress(),
      spender: fakeAddress(),
    };
    const allowance = faker.number.bigInt({ min: 1n });
    mockHistory({
      multisig: [approveTransaction(multisigApproval)],
      module: [
        moduleTransactionBuilder()
          .with('to', moduleApproval.tokenAddress)
          .with(
            'data',
            erc20ApproveEncoder()
              .with('spender', moduleApproval.spender)
              .encode(),
          )
          .with('operation', Operation.CALL)
          .with('isSuccessful', true)
          .build(),
      ],
    });
    mockAllowances(allowance);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual).toStrictEqual({
      approvals: [
        { ...multisigApproval, allowance },
        { ...moduleApproval, allowance },
      ],
      isHistoryComplete: true,
    });
    expect(safeRepository.getMultisigTransactions).toHaveBeenCalledWith({
      chainId,
      safeAddress,
      executed: true,
      limit: HISTORY_PAGE_SIZE,
      offset: 0,
    });
    expect(safeRepository.getModuleTransactions).toHaveBeenCalledWith({
      chainId,
      safeAddress,
      limit: HISTORY_PAGE_SIZE,
      offset: 0,
    });
    expect(client.multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        allowFailure: true,
        multicallAddress: MULTICALL3_ADDRESS,
        contracts: [multisigApproval, moduleApproval].map((approval) => ({
          address: approval.tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [safeAddress, approval.spender],
        })),
      }),
    );
  });

  it('finds the approvals batched in a delegatecalled MultiSend', async () => {
    const approval = { tokenAddress: fakeAddress(), spender: fakeAddress() };
    const allowance = faker.number.bigInt({ min: 1n });
    mockHistory({
      multisig: [
        multisigTransactionBuilder()
          .with(
            'data',
            multiSendEncoder()
              .with(
                'transactions',
                multiSendTransactionsEncoder([
                  {
                    operation: Operation.CALL,
                    to: approval.tokenAddress,
                    value: 0n,
                    data: erc20ApproveEncoder()
                      .with('spender', approval.spender)
                      .encode(),
                  },
                ]),
              )
              .encode(),
          )
          .with('operation', Operation.DELEGATE)
          .with('isSuccessful', true)
          .build(),
      ],
    });
    mockAllowances(allowance);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([{ ...approval, allowance }]);
    expect(client.getTransactionReceipt).not.toHaveBeenCalled();
  });

  it('drops approvals that were spent or revoked', async () => {
    mockHistory({
      multisig: [
        approveTransaction({
          tokenAddress: fakeAddress(),
          spender: fakeAddress(),
        }),
      ],
    });
    mockAllowances(0n);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([]);
  });

  it('drops tokens that do not answer allowance', async () => {
    const approval = { tokenAddress: fakeAddress(), spender: fakeAddress() };
    const notErc20 = { tokenAddress: fakeAddress(), spender: fakeAddress() };
    const allowance = faker.number.bigInt({ min: 1n });
    mockHistory({
      multisig: [approveTransaction(approval), approveTransaction(notErc20)],
    });
    mockAllowances(allowance, [notErc20.tokenAddress]);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([{ ...approval, allowance }]);
  });

  it('reads each token and spender pair once', async () => {
    const approval = { tokenAddress: fakeAddress(), spender: fakeAddress() };
    const allowance = faker.number.bigInt({ min: 1n });
    mockHistory({
      multisig: [approveTransaction(approval), approveTransaction(approval)],
    });
    mockAllowances(allowance);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([{ ...approval, allowance }]);
  });

  it('skips failed transactions', async () => {
    mockHistory({
      multisig: [
        {
          ...approveTransaction({
            tokenAddress: fakeAddress(),
            spender: fakeAddress(),
          }),
          isSuccessful: false,
        },
      ],
    });

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([]);
    expect(client.multicall).not.toHaveBeenCalled();
  });

  it('reads the events of a delegatecall to a contract other than MultiSend', async () => {
    const approval = { tokenAddress: fakeAddress(), spender: fakeAddress() };
    const allowance = faker.number.bigInt({ min: 1n });
    const transactionHash = faker.string.hexadecimal({ length: 64 }) as Hash;
    mockHistory({
      multisig: [
        multisigTransactionBuilder()
          .with('operation', Operation.DELEGATE)
          .with('isSuccessful', true)
          .with('transactionHash', transactionHash)
          .build(),
      ],
    });
    client.getTransactionReceipt.mockResolvedValue({
      logs: [
        ...receiptWithApproval({ ...approval, owner: safeAddress }).logs,
        // An approval given by another account in the same transaction
        ...receiptWithApproval({
          tokenAddress: fakeAddress(),
          owner: fakeAddress(),
          spender: fakeAddress(),
        }).logs,
      ],
    } as unknown as TransactionReceipt);
    mockAllowances(allowance);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([{ ...approval, allowance }]);
    expect(client.getTransactionReceipt).toHaveBeenCalledTimes(1);
    expect(client.getTransactionReceipt).toHaveBeenCalledWith({
      hash: transactionHash,
    });
  });

  it('reads every page of a history list', async () => {
    const count = HISTORY_PAGE_SIZE * 2 + 1;
    const approvals = Array.from({ length: maxPages }, () => ({
      tokenAddress: fakeAddress(),
      spender: fakeAddress(),
    }));
    const allowance = faker.number.bigInt({ min: 1n });
    mockHistory({});
    safeRepository.getMultisigTransactions.mockImplementation(
      ({ offset = 0 }) =>
        Promise.resolve(
          pageBuilder<MultisigTransaction>()
            .with('count', count)
            .with('results', [
              approveTransaction(approvals[offset / HISTORY_PAGE_SIZE]),
            ])
            .build(),
        ),
    );
    mockAllowances(allowance);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual).toStrictEqual({
      approvals: approvals.map((approval) => ({ ...approval, allowance })),
      isHistoryComplete: true,
    });
    expect(safeRepository.getMultisigTransactions).toHaveBeenCalledTimes(3);
  });

  it('stops at the page limit and reports the history as incomplete', async () => {
    mockHistory({});
    safeRepository.getModuleTransactions.mockResolvedValue(
      pageBuilder<ModuleTransaction>()
        .with('count', HISTORY_PAGE_SIZE * maxPages + 1)
        .with('results', [])
        .build(),
    );

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual).toStrictEqual({ approvals: [], isHistoryComplete: false });
    expect(safeRepository.getModuleTransactions).toHaveBeenCalledTimes(
      maxPages,
    );
  });

  it('fails when a history page cannot be read', async () => {
    const error = new Error(faker.lorem.sentence());
    mockHistory({});
    safeRepository.getMultisigTransactions
      .mockResolvedValueOnce(
        pageBuilder<MultisigTransaction>()
          .with('count', HISTORY_PAGE_SIZE + 1)
          .with('results', [])
          .build(),
      )
      .mockRejectedValueOnce(error);

    await expect(
      target.getTokenApprovals({ chainId, safeAddress }),
    ).rejects.toThrow(error);
  });
});
