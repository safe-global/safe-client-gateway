import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { gasPriceFixedEIP1559Builder } from '@/domain/chains/entities/__tests__/gas-price-fixed-eip-1559.builder';
import { gasPriceFixedBuilder } from '@/domain/chains/entities/__tests__/gas-price-fixed.builder';
import { gasPriceOracleBuilder } from '@/domain/chains/entities/__tests__/gas-price-oracle.builder';
import { nativeCurrencyBuilder } from '@/domain/chains/entities/__tests__/native.currency.builder';
import { rpcUriBuilder } from '@/domain/chains/entities/__tests__/rpc-uri.builder';
import { themeBuilder } from '@/domain/chains/entities/__tests__/theme.builder';
import {
  ChainSchema,
  GasPriceFixedEip1559Schema,
  GasPriceFixedSchema,
  GasPriceOracleSchema,
  GasPriceSchema,
  NativeCurrencySchema,
  RpcUriSchema,
  ThemeSchema,
} from '@/domain/chains/entities/schemas/chain.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('Chain schemas', () => {
  describe('NativeCurrencySchema', () => {
    it('should validate a valid native currency', () => {
      const nativeCurrency = nativeCurrencyBuilder().build();

      const result = NativeCurrencySchema.safeParse(nativeCurrency);

      expect(result.success).toBe(true);
    });

    it('should not validate a native currency with an invalid logoUri', () => {
      const nativeCurrency = { invalid: 'nativeCurrency' };

      const result = NativeCurrencySchema.safeParse(nativeCurrency);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['name'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['symbol'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'undefined',
            path: ['decimals'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['logoUri'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('RpcUriSchema', () => {
    it('should validate a valid RPC URI', () => {
      const rpcUri = rpcUriBuilder().build();

      const result = RpcUriSchema.safeParse(rpcUri);

      expect(result.success).toBe(true);
    });

    it('should default the authentication to UNKNOWN', () => {
      const rpcUri = {
        value: faker.internet.url(),
      };

      const result = RpcUriSchema.safeParse(rpcUri);

      expect(result.success && result.data.authentication).toBe('UNKNOWN');
    });

    it('does not allow invalid RPC URIs', () => {
      const rpcUri = { invalid: 'rpcUri' };

      const result = RpcUriSchema.safeParse(rpcUri);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['value'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('ThemeSchema', () => {
    it('should validate a valid theme', () => {
      const theme = themeBuilder().build();

      const result = ThemeSchema.safeParse(theme);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid theme', () => {
      const theme = { invalid: 'theme' };

      const result = ThemeSchema.safeParse(theme);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['textColor'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['backgroundColor'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('GasPriceOracleSchema', () => {
    it('should validate a valid gas price oracle', () => {
      const gasPriceOracle = gasPriceOracleBuilder().build();

      const result = GasPriceOracleSchema.safeParse(gasPriceOracle);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price oracle', () => {
      const gasPriceOracle = { invalid: 'gasPriceOracle' };

      const result = GasPriceOracleSchema.safeParse(gasPriceOracle);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          // @ts-expect-error - inferred types don't allow literal strings
          {
            code: 'invalid_literal',
            expected: 'oracle',
            path: ['type'],
            message: 'Invalid literal value, expected "oracle"',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['uri'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gasParameter'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gweiFactor'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('GasPriceFixedSchema', () => {
    it('should validate a valid gas price fixed', () => {
      const gasPriceFixed = gasPriceFixedBuilder().build();

      const result = GasPriceFixedSchema.safeParse(gasPriceFixed);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price fixed', () => {
      const gasPriceFixed = { invalid: 'gasPriceFixed' };

      const result = GasPriceFixedSchema.safeParse(gasPriceFixed);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          // @ts-expect-error - inferred types don't allow literal strings
          {
            code: 'invalid_literal',
            expected: 'fixed',
            path: ['type'],
            message: 'Invalid literal value, expected "fixed"',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['weiValue'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('GasPriceFixedEip1559Schema', () => {
    it('should validate a valid gas price fixed 1559', () => {
      const gasPriceFixedEip1559 = gasPriceFixedEIP1559Builder().build();

      const result = GasPriceFixedEip1559Schema.safeParse(gasPriceFixedEip1559);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price fixed 1559', () => {
      const gasPriceFixedEip1559 = { invalid: 'gasPriceFixedEip1559' };

      const result = GasPriceFixedEip1559Schema.safeParse(gasPriceFixedEip1559);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          // @ts-expect-error - inferred types don't allow literal strings
          {
            code: 'invalid_literal',
            expected: 'fixed1559',
            path: ['type'],
            message: 'Invalid literal value, expected "fixed1559"',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['maxFeePerGas'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['maxPriorityFeePerGas'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('GasPriceSchema', () => {
    it.each([
      ['oracle', gasPriceOracleBuilder],
      ['fixed', gasPriceFixedBuilder],
      ['fixed1559', gasPriceFixedEIP1559Builder],
    ])('should validate a valid %s gas price', (_, builder) => {
      const gasPrice = builder().build();

      const result = GasPriceSchema.safeParse([gasPrice]);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price', () => {
      const gasPrice = [
        // type is schema discriminator
        { type: faker.string.sample() },
      ];

      const result = GasPriceSchema.safeParse(gasPrice);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_union_discriminator',
            options: ['oracle', 'fixed', 'fixed1559'],
            path: [0, 'type'],
            message:
              "Invalid discriminator value. Expected 'oracle' | 'fixed' | 'fixed1559'",
          },
        ]),
      );
    });
  });

  describe('ChainSchema', () => {
    it('should validate a valid chain', () => {
      const chain = chainBuilder().build();

      const result = ChainSchema.safeParse(chain);

      expect(result.success).toBe(true);
    });

    it.each([
      ['chainLogoUri' as const],
      ['ensRegistryAddress' as const],
      ['pricesProviderChainName' as const],
      ['pricesProviderNativeCoin' as const],
    ])('should allow undefined %s and default to null', (field) => {
      const chain = chainBuilder().build();
      delete chain[field];

      const result = ChainSchema.safeParse(chain);

      expect(result.success && result.data[field]).toBe(null);
    });

    it.each([
      ['chainId' as const],
      ['chainName' as const],
      ['description' as const],
      ['shortName' as const],
      ['transactionService' as const],
      ['vpcTransactionService' as const],
      ['recommendedMasterCopyVersion' as const],
    ])('should not validate a chain without %s', (field) => {
      const chain = chainBuilder().build();
      delete chain[field];

      const result = ChainSchema.safeParse(chain);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: [field],
            message: 'Required',
          },
        ]),
      );
    });
  });
});
