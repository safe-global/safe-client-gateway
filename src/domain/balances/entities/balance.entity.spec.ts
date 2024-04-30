import { balanceBuilder } from '@/domain/balances/entities/__tests__/balance.builder';
import {
  BalanceSchema,
  Erc20BalanceSchema,
  NativeBalanceSchema,
} from '@/domain/balances/entities/balance.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('Balance entity schemas', () => {
  describe('NativeBalanceSchema', () => {
    it('should validate a valid native balance', () => {
      const nativeBalance = balanceBuilder()
        .with('tokenAddress', null)
        .with('token', null)
        .build();

      const result = NativeBalanceSchema.safeParse(nativeBalance);

      expect(result.success).toBe(true);
    });

    it('should allow optional tokenAddress and token and default to null', () => {
      const nativeBalance = balanceBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete nativeBalance.tokenAddress;
      // @ts-expect-error - inferred types don't allow optional fields
      delete nativeBalance.token;

      const result = NativeBalanceSchema.safeParse(nativeBalance);

      expect(result.success && result.data.tokenAddress).toBe(null);
      expect(result.success && result.data.token).toBe(null);
    });

    it('should not allow an invalid native balance', () => {
      const nativeBalance = { invalid: 'nativeBalance' };

      const result = NativeBalanceSchema.safeParse(nativeBalance);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['balance'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('Erc20BalanceSchema', () => {
    it('should validate a valid ERC-20 balance', () => {
      const erc20Balance = balanceBuilder().build();

      const result = Erc20BalanceSchema.safeParse(erc20Balance);

      expect(result.success).toBe(true);
    });

    it('should checksum the tokenAddress', () => {
      const nonChecksummedTokenAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const erc20Balance = balanceBuilder()
        .with('tokenAddress', nonChecksummedTokenAddress)
        .build();

      const result = Erc20BalanceSchema.safeParse(erc20Balance);

      expect(result.success && result.data.tokenAddress).toBe(
        getAddress(nonChecksummedTokenAddress),
      );
    });

    it('should not allow an invalid ERC-20 balance', () => {
      const erc20Balance = { invalid: 'erc20Balance' };

      const result = NativeBalanceSchema.safeParse(erc20Balance);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['balance'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('BalanceSchema', () => {
    it('should validate a valid native balance', () => {
      const nativeBalance = balanceBuilder()
        .with('tokenAddress', null)
        .with('token', null)
        .build();

      const result = BalanceSchema.safeParse(nativeBalance);

      expect(result.success).toBe(true);
    });

    it('should validate a valid ERC-20 balance', () => {
      const erc20Balance = balanceBuilder().build();

      const result = BalanceSchema.safeParse(erc20Balance);

      expect(result.success).toBe(true);
    });

    it('should not allow an invalid balance', () => {
      const balance = { invalid: 'balance' };

      const result = BalanceSchema.safeParse(balance);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_union',
            unionErrors: [
              // @ts-expect-error - unionError is missing some properties (zod-based error)
              {
                issues: [
                  {
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'undefined',
                    path: ['balance'],
                    message: 'Required',
                  },
                ],
                name: 'ZodError',
              },
              // @ts-expect-error - unionError is missing some properties (zod-based error)
              {
                issues: [
                  {
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'undefined',
                    path: ['tokenAddress'],
                    message: 'Required',
                  },
                  {
                    code: 'invalid_type',
                    expected: 'object',
                    received: 'undefined',
                    path: ['token'],
                    message: 'Required',
                  },
                  {
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'undefined',
                    path: ['balance'],
                    message: 'Required',
                  },
                ],
                name: 'ZodError',
              },
            ],
            path: [],
            message: 'Invalid input',
          },
        ]),
      );
    });

    it('should allow optional fiatBalance and fiatConversion and default to null', () => {
      const nativeBalance = balanceBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete nativeBalance.fiatBalance;
      // @ts-expect-error - inferred types don't allow optional fields
      delete nativeBalance.fiatConversion;

      const result = BalanceSchema.safeParse(nativeBalance);

      expect(result.success && result.data.fiatBalance).toBe(null);
      expect(result.success && result.data.fiatConversion).toBe(null);
    });

    it('should now allow a malformed balance-type', () => {
      const nativeBalance = balanceBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete nativeBalance.token; // Native balance-like, but ERC-20 balance requires it

      const result = BalanceSchema.safeParse(nativeBalance);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_union',
            unionErrors: [
              // @ts-expect-error - unionError is missing some properties (zod-based error)
              {
                issues: [
                  {
                    code: 'invalid_type',
                    expected: 'null',
                    received: 'string',
                    path: ['tokenAddress'],
                    message: 'Expected null, received string',
                  },
                ],
                name: 'ZodError',
              },
              // @ts-expect-error - unionError is missing some properties (zod-based error)
              {
                issues: [
                  {
                    code: 'invalid_type',
                    expected: 'object',
                    received: 'undefined',
                    path: ['token'],
                    message: 'Required',
                  },
                ],
                name: 'ZodError',
              },
            ],
            path: [],
            message: 'Invalid input',
          },
        ]),
      );
    });
  });
});
