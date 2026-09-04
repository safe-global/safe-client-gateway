// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { balanceBuilder } from '@/modules/balances/domain/entities/__tests__/balance.builder';
import { balanceTokenBuilder } from '@/modules/balances/domain/entities/__tests__/balance.token.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { nativeCurrencyBuilder } from '@/modules/chains/domain/entities/__tests__/native.currency.builder';
import {
  analyzeTransaction,
  getCalledContracts,
  hasDelegateCallOutside,
  touchesAddress,
  valueTransaction,
} from '@/modules/cloud-cosigner/domain/transaction-analysis';
import type { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

function erc20Decoded(
  method: 'transfer' | 'approve' | 'transferFrom',
  to: string,
  amount: string,
): DataDecoded {
  const parameters =
    method === 'transferFrom'
      ? [
          {
            name: 'from',
            type: 'address',
            value: faker.finance.ethereumAddress(),
          },
          { name: 'to', type: 'address', value: to },
          { name: 'value', type: 'uint256', value: amount },
        ]
      : [
          { name: 'to', type: 'address', value: to },
          { name: 'value', type: 'uint256', value: amount },
        ];
  return { method, parameters, accuracy: 'FULL_MATCH' };
}

describe('transaction-analysis', () => {
  const chain = chainBuilder()
    .with(
      'nativeCurrency',
      nativeCurrencyBuilder()
        .with('decimals', 18)
        .with('symbol', 'ETH')
        .build(),
    )
    .build();

  describe('analyzeTransaction', () => {
    it('should treat a plain value transfer as a native leg without a contract call', () => {
      const recipient = getAddress(faker.finance.ethereumAddress());
      const transaction = multisigTransactionBuilder()
        .with('to', recipient)
        .with('value', '1000')
        .with('data', null)
        .with('operation', Operation.CALL)
        .build();

      const analysis = analyzeTransaction({ transaction, dataDecoded: null });

      expect(analysis.legs).toStrictEqual([
        {
          kind: 'native',
          tokenAddress: null,
          amount: 1000n,
          method: null,
          counterparty: recipient,
        },
      ]);
      expect(getCalledContracts(analysis)).toStrictEqual([]);
    });

    it('should extract an ERC-20 transfer as a token leg against the token contract', () => {
      const token = getAddress(faker.finance.ethereumAddress());
      const recipient = getAddress(faker.finance.ethereumAddress());
      const transaction = multisigTransactionBuilder()
        .with('to', token)
        .with('value', '0')
        .with('data', faker.string.hexadecimal({ length: 136 }) as Hex)
        .with('operation', Operation.CALL)
        .build();

      const analysis = analyzeTransaction({
        transaction,
        dataDecoded: erc20Decoded('transfer', recipient, '5000000'),
      });

      expect(analysis.legs).toStrictEqual([
        {
          kind: 'erc20',
          tokenAddress: token,
          amount: 5_000_000n,
          method: 'transfer',
          counterparty: recipient,
        },
      ]);
      expect(getCalledContracts(analysis)).toStrictEqual([token]);
    });

    it('should count approvals as exposure and pick the recipient of transferFrom', () => {
      const token = getAddress(faker.finance.ethereumAddress());
      const spender = getAddress(faker.finance.ethereumAddress());
      const transaction = multisigTransactionBuilder()
        .with('to', token)
        .with('value', '0')
        .with('operation', Operation.CALL)
        .build();

      const approve = analyzeTransaction({
        transaction,
        dataDecoded: erc20Decoded('approve', spender, '1'),
      });
      const transferFrom = analyzeTransaction({
        transaction,
        dataDecoded: erc20Decoded('transferFrom', spender, '2'),
      });

      expect(approve.legs[0]).toMatchObject({
        method: 'approve',
        counterparty: spender,
        amount: 1n,
      });
      expect(transferFrom.legs[0]).toMatchObject({
        method: 'transferFrom',
        counterparty: spender,
        amount: 2n,
      });
    });

    it('should flatten a MultiSend batch into its inner calls', () => {
      const multiSend = getAddress(faker.finance.ethereumAddress());
      const token = getAddress(faker.finance.ethereumAddress());
      const recipient = getAddress(faker.finance.ethereumAddress());
      const transaction = multisigTransactionBuilder()
        .with('to', multiSend)
        .with('value', '0')
        .with('operation', Operation.DELEGATE)
        .build();
      const dataDecoded: DataDecoded = {
        method: 'multiSend',
        accuracy: 'FULL_MATCH',
        parameters: [
          {
            name: 'transactions',
            type: 'bytes',
            value: '0x',
            valueDecoded: [
              {
                operation: Operation.CALL,
                to: recipient,
                value: '7',
                data: null,
                dataDecoded: null,
              },
              {
                operation: Operation.CALL,
                to: token,
                value: '0',
                data: '0xa9059cbb',
                dataDecoded: erc20Decoded('transfer', recipient, '9'),
              },
            ],
          },
        ],
      };

      const analysis = analyzeTransaction({ transaction, dataDecoded });

      expect(analysis.isMultiSend).toBe(true);
      expect(analysis.legs).toHaveLength(2);
      expect(analysis.legs[0]).toMatchObject({ kind: 'native', amount: 7n });
      expect(analysis.legs[1]).toMatchObject({ kind: 'erc20', amount: 9n });
      expect(getCalledContracts(analysis)).toStrictEqual([multiSend, token]);
      expect(hasDelegateCallOutside(analysis, [multiSend])).toBe(false);
      expect(hasDelegateCallOutside(analysis, [])).toBe(true);
    });

    it('should detect a call to a given address only when it carries data', () => {
      const safe = getAddress(faker.finance.ethereumAddress());
      const withData = analyzeTransaction({
        transaction: multisigTransactionBuilder()
          .with('to', safe)
          .with('value', '0')
          .with('data', '0x694e80c3')
          .with('operation', Operation.CALL)
          .build(),
        dataDecoded: null,
      });
      const withoutData = analyzeTransaction({
        transaction: multisigTransactionBuilder()
          .with('to', safe)
          .with('value', '1')
          .with('data', '0x')
          .with('operation', Operation.CALL)
          .build(),
        dataDecoded: null,
      });

      expect(touchesAddress(withData, safe)).toBe(true);
      expect(touchesAddress(withoutData, safe)).toBe(false);
    });
  });

  describe('valueTransaction', () => {
    it('should price native and known tokens from the balance list', () => {
      const token = getAddress(faker.finance.ethereumAddress());
      const balances = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('token', null)
          .with('fiatConversion', '2000')
          .build(),
        balanceBuilder()
          .with('tokenAddress', token)
          .with(
            'token',
            balanceTokenBuilder()
              .with('decimals', 6)
              .with('symbol', 'USDC')
              .build(),
          )
          .with('fiatConversion', '1')
          .build(),
      ];
      const analysis = {
        isMultiSend: false,
        calls: [],
        legs: [
          {
            kind: 'native' as const,
            tokenAddress: null,
            amount: 10n ** 18n,
            method: null,
            counterparty: null,
          },
          {
            kind: 'erc20' as const,
            tokenAddress: token,
            amount: 5_000_000n,
            method: 'transfer',
            counterparty: null,
          },
        ],
      };

      const valuation = valueTransaction({ analysis, balances, chain });

      expect(valuation.knownFiatValue).toBe(2005);
      expect(valuation.hasUnknownValue).toBe(false);
      expect(valuation.legs[0]).toMatchObject({
        symbol: 'ETH',
        formattedAmount: '1',
        fiatValue: 2000,
      });
      expect(valuation.legs[1]).toMatchObject({
        symbol: 'USDC',
        formattedAmount: '5',
        fiatValue: 5,
      });
    });

    it('should flag a token the Safe does not hold as unknown value', () => {
      const analysis = {
        isMultiSend: false,
        calls: [],
        legs: [
          {
            kind: 'erc20' as const,
            tokenAddress: getAddress(faker.finance.ethereumAddress()),
            amount: 1n,
            method: 'transfer',
            counterparty: null,
          },
        ],
      };

      const valuation = valueTransaction({ analysis, balances: [], chain });

      expect(valuation.knownFiatValue).toBe(0);
      expect(valuation.hasUnknownValue).toBe(true);
      expect(valuation.legs[0]).toMatchObject({
        symbol: null,
        formattedAmount: null,
        fiatValue: null,
      });
    });

    it('should flag a held token without a price as unknown value', () => {
      const token = getAddress(faker.finance.ethereumAddress());
      const balances = [
        balanceBuilder()
          .with('tokenAddress', token)
          .with('token', balanceTokenBuilder().with('decimals', 18).build())
          .with('fiatConversion', null)
          .build(),
      ];
      const analysis = {
        isMultiSend: false,
        calls: [],
        legs: [
          {
            kind: 'erc20' as const,
            tokenAddress: token,
            amount: 1n,
            method: 'transfer',
            counterparty: null,
          },
        ],
      };

      const valuation = valueTransaction({ analysis, balances, chain });

      expect(valuation.hasUnknownValue).toBe(true);
      expect(valuation.legs[0].formattedAmount).not.toBeNull();
    });
  });
});
