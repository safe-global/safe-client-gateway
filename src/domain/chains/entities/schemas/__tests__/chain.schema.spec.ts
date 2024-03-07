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
import { getAddress } from 'viem';
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
      const rpcUri = rpcUriBuilder().build();
      // @ts-expect-error - inferred types don't allow optional types
      delete rpcUri.authentication;

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
    it('should validate a valid gas price', () => {
      const gasPrice = faker.helpers
        .arrayElements(
          [
            gasPriceOracleBuilder,
            gasPriceFixedBuilder,
            gasPriceFixedEIP1559Builder,
          ],
          {
            min: 3,
            max: 9,
          },
        )
        .map((builder) => builder().build());

      const result = GasPriceSchema.safeParse(gasPrice);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price', () => {
      const gasPrice = [
        { invalid: 'gasPriceOracle' },
        { invalid: 'gasPriceFixed' },
        { invalid: 'gasPriceFixedEip1559' },
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
          {
            code: 'invalid_union_discriminator',
            options: ['oracle', 'fixed', 'fixed1559'],
            path: [1, 'type'],
            message:
              "Invalid discriminator value. Expected 'oracle' | 'fixed' | 'fixed1559'",
          },
          {
            code: 'invalid_union_discriminator',
            options: ['oracle', 'fixed', 'fixed1559'],
            path: [2, 'type'],
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

    it('should allow null chainLogoUri and ensRegistryAddress', () => {
      const chain = chainBuilder()
        .with('chainLogoUri', null)
        .with('ensRegistryAddress', null)
        .build();

      const result = ChainSchema.safeParse(chain);

      expect(result.success).toBe(true);
    });

    it('should allow undefined chainLogoUri and ensRegistryAddress and default to null', () => {
      const chain = chainBuilder().build();
      // @ts-expect-error - inferred types don't allow optional types
      delete chain.chainLogoUri;
      // @ts-expect-error - inferred types don't allow optional types
      delete chain.ensRegistryAddress;

      const result = ChainSchema.safeParse(chain);

      expect(result.success && result.data.chainLogoUri).toBe(null);
      expect(result.success && result.data.ensRegistryAddress).toBe(null);
    });

    it('should checksum the ensRegistryAddress', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const chain = chainBuilder()
        .with('ensRegistryAddress', nonChecksummedAddress)
        .build();

      const result = ChainSchema.safeParse(chain);

      expect(result.success && result.data.ensRegistryAddress).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should not validate an invalid chain', () => {
      const chain = { invalid: 'chain' };

      const result = ChainSchema.safeParse(chain);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['chainId'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['chainName'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['description'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'boolean',
            received: 'undefined',
            path: ['l2'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'boolean',
            received: 'undefined',
            path: ['isTestnet'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['shortName'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: ['rpcUri'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: ['safeAppsRpcUri'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: ['publicRpcUri'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: ['blockExplorerUriTemplate'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: ['nativeCurrency'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['transactionService'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['vpcTransactionService'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: ['theme'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'undefined',
            path: ['gasPrice'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'undefined',
            path: ['disabledWallets'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'undefined',
            path: ['features'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['recommendedMasterCopyVersion'],
            message: 'Required',
          },
        ]),
      );
    });
  });
});
