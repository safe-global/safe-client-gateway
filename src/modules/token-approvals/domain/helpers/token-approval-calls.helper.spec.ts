// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, encodeFunctionData, getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '#/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { erc20TransferEncoder } from '#/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { SafeCall } from '#/modules/token-approvals/domain/entities/token-approval-call.entity';
import { TokenApprovalCallsHelper } from '#/modules/token-approvals/domain/helpers/token-approval-calls.helper';
import {
  ALLOWANCE_FUNCTION_SELECTORS,
  ALLOWANCE_FUNCTIONS_ABI,
} from '#/modules/token-approvals/domain/token-approvals.constants';

const loggingService = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

function fakeAddress(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

function approveCall(): SafeCall & { data: Hex; spender: Address } {
  const spender = fakeAddress();
  return {
    to: fakeAddress(),
    operation: Operation.CALL,
    spender,
    data: encodeFunctionData({
      abi: ALLOWANCE_FUNCTIONS_ABI,
      functionName: 'approve',
      args: [spender, faker.number.bigInt()],
    }),
  };
}

function multiSendCall(
  actions: Array<{ to: Address; data: Hex; operation: Operation }>,
  operation = Operation.DELEGATE,
): SafeCall & { data: Hex } {
  return {
    to: fakeAddress(),
    operation,
    data: multiSendEncoder()
      .with(
        'transactions',
        multiSendTransactionsEncoder(
          actions.map((action) => ({ ...action, value: 0n })),
        ),
      )
      .encode(),
  };
}

describe('TokenApprovalCallsHelper', () => {
  const target = new TokenApprovalCallsHelper(
    new MultiSendDecoder(loggingService),
    loggingService,
  );

  it.each(['approve', 'increaseAllowance', 'decreaseAllowance'] as const)(
    'finds the spender of a direct %s call',
    (functionName) => {
      const tokenAddress = fakeAddress();
      const spender = fakeAddress();
      const data = encodeFunctionData({
        abi: ALLOWANCE_FUNCTIONS_ABI,
        functionName,
        args: [spender, faker.number.bigInt()],
      });

      const actual = target.findApprovals({
        to: tokenAddress,
        data,
        operation: Operation.CALL,
      });

      expect(actual).toStrictEqual({
        tokenSpenders: [{ tokenAddress, spender }],
        hasOpaqueDelegateCall: false,
      });
    },
  );

  it('finds nothing in a call that sets no allowance', () => {
    const actual = target.findApprovals({
      to: fakeAddress(),
      data: faker.helpers.arrayElement([
        null,
        '0x',
        erc20TransferEncoder().encode(),
      ]),
      operation: Operation.CALL,
    });

    expect(actual).toStrictEqual({
      tokenSpenders: [],
      hasOpaqueDelegateCall: false,
    });
  });

  it('finds nothing in an allowance call with malformed arguments', () => {
    const actual = target.findApprovals({
      to: fakeAddress(),
      data: faker.helpers.arrayElement(ALLOWANCE_FUNCTION_SELECTORS),
      operation: Operation.CALL,
    });

    expect(actual).toStrictEqual({
      tokenSpenders: [],
      hasOpaqueDelegateCall: false,
    });
  });

  it('finds the approvals batched in a delegatecalled MultiSend', () => {
    const approvals = [approveCall(), approveCall()];

    const actual = target.findApprovals(multiSendCall(approvals));

    expect(actual).toStrictEqual({
      tokenSpenders: approvals.map(({ to, spender }) => ({
        tokenAddress: to,
        spender,
      })),
      hasOpaqueDelegateCall: false,
    });
  });

  it('finds the approvals of a MultiSend nested in a MultiSend', () => {
    const outer = approveCall();
    const inner = approveCall();

    const actual = target.findApprovals(
      multiSendCall([outer, multiSendCall([inner])]),
    );

    expect(actual).toStrictEqual({
      tokenSpenders: [
        { tokenAddress: outer.to, spender: outer.spender },
        { tokenAddress: inner.to, spender: inner.spender },
      ],
      hasOpaqueDelegateCall: false,
    });
  });

  it('ignores a MultiSend reached by a plain call', () => {
    const actual = target.findApprovals(
      multiSendCall([approveCall()], Operation.CALL),
    );

    expect(actual).toStrictEqual({
      tokenSpenders: [],
      hasOpaqueDelegateCall: false,
    });
  });

  it('flags a delegatecall to a contract other than MultiSend', () => {
    const actual = target.findApprovals({
      ...approveCall(),
      operation: Operation.DELEGATE,
    });

    expect(actual).toStrictEqual({
      tokenSpenders: [],
      hasOpaqueDelegateCall: true,
    });
  });

  it('flags a MultiSend that batches a delegatecall to another contract', () => {
    const approval = approveCall();

    const actual = target.findApprovals(
      multiSendCall([
        approval,
        { ...approveCall(), operation: Operation.DELEGATE },
      ]),
    );

    expect(actual).toStrictEqual({
      tokenSpenders: [{ tokenAddress: approval.to, spender: approval.spender }],
      hasOpaqueDelegateCall: true,
    });
  });

  it('flags a delegatecall with the MultiSend selector that is not a valid batch', () => {
    const actual = target.findApprovals({
      to: fakeAddress(),
      data: multiSendEncoder().with('transactions', '0x').encode(),
      operation: Operation.DELEGATE,
    });

    expect(actual).toStrictEqual({
      tokenSpenders: [],
      hasOpaqueDelegateCall: true,
    });
  });
});
