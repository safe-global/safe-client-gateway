import { balancesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/balances-provider.builder';
import { beaconChainExplorerUriTemplateBuilder } from '@/modules/chains/domain/entities/__tests__/beacon-chain-explorer-uri-template.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { contractAddressesBuilder } from '@/modules/chains/domain/entities/__tests__/contract-addresses.builder';
import { gasPriceFixedEIP1559Builder } from '@/modules/chains/domain/entities/__tests__/gas-price-fixed-eip-1559.builder';
import { gasPriceFixedBuilder } from '@/modules/chains/domain/entities/__tests__/gas-price-fixed.builder';
import { gasPriceOracleBuilder } from '@/modules/chains/domain/entities/__tests__/gas-price-oracle.builder';
import { nativeCurrencyBuilder } from '@/modules/chains/domain/entities/__tests__/native.currency.builder';
import { pricesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/prices-provider.builder';
import { rpcUriBuilder } from '@/modules/chains/domain/entities/__tests__/rpc-uri.builder';
import { themeBuilder } from '@/modules/chains/domain/entities/__tests__/theme.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import {
  ChainSchema,
  BalancesProviderSchema,
  GasPriceFixedEip1559Schema,
  GasPriceFixedSchema,
  GasPriceOracleSchema,
  GasPriceSchema,
  NativeCurrencySchema,
  PricesProviderSchema,
  RpcUriSchema,
  ThemeSchema,
  ContractAddressesSchema,
  ChainLenientPageSchema,
  BeaconChainExplorerUriTemplateSchema,
} from '@/modules/chains/domain/entities/schemas/chain.schema';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['name'],
          message: 'Invalid input: expected string, received undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['symbol'],
          message: 'Invalid input: expected string, received undefined',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          path: ['decimals'],
          message: 'Invalid input: expected number, received undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['logoUri'],
          message: 'Invalid input: expected string, received undefined',
        },
      ]);
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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['value'],
          message: 'Invalid input: expected string, received undefined',
        },
      ]);
    });
  });

  describe('BeaconChainExplorerUriTemplate', () => {
    it('should validate a BeaconChainExplorerUriTemplate', () => {
      const beaconChainExplorerUriTemplate =
        beaconChainExplorerUriTemplateBuilder().build();

      const result = BeaconChainExplorerUriTemplateSchema.safeParse(
        beaconChainExplorerUriTemplate,
      );

      expect(result.success).toBe(true);
    });

    it('should allow a string publicKey', () => {
      const beaconChainExplorerUriTemplate =
        beaconChainExplorerUriTemplateBuilder()
          .with(
            'publicKey',
            `${faker.internet.url({ appendSlash: false })}/{{publicKey}}`,
          )
          .build();

      const result = BeaconChainExplorerUriTemplateSchema.safeParse(
        beaconChainExplorerUriTemplate,
      );

      expect(result.success).toBe(true);
    });

    it('should allow a null publicKey', () => {
      const beaconChainExplorerUriTemplate =
        beaconChainExplorerUriTemplateBuilder().with('publicKey', null).build();

      const result = BeaconChainExplorerUriTemplateSchema.safeParse(
        beaconChainExplorerUriTemplate,
      );

      expect(result.success).toBe(true);
    });

    it('should default publicKey to null', () => {
      const beaconChainExplorerUriTemplate = {
        publicKey: null,
      };

      const result = BeaconChainExplorerUriTemplateSchema.safeParse(
        beaconChainExplorerUriTemplate,
      );

      expect(result.success && result.data.publicKey).toBe(null);
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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['textColor'],
          message: 'Invalid input: expected string, received undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['backgroundColor'],
          message: 'Invalid input: expected string, received undefined',
        },
      ]);
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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_value',
          path: ['type'],
          message: 'Invalid input: expected "oracle"',
          values: ['oracle'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['uri'],
          message: 'Invalid input: expected string, received undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['gasParameter'],
          message: 'Invalid input: expected string, received undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['gweiFactor'],
          message: 'Invalid input: expected string, received undefined',
        },
      ]);
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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_value',
          path: ['type'],
          message: 'Invalid input: expected "fixed"',
          values: ['fixed'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['weiValue'],
          message: 'Invalid input: expected string, received undefined',
        },
      ]);
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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_value',
          path: ['type'],
          message: 'Invalid input: expected "fixed1559"',
          values: ['fixed1559'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['maxFeePerGas'],
          message: 'Invalid input: expected string, received undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['maxPriorityFeePerGas'],
          message: 'Invalid input: expected string, received undefined',
        },
      ]);
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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_union',
          discriminator: 'type',
          errors: [],
          message: 'Invalid input',
          note: 'No matching discriminator',
          path: [0, 'type'],
        },
      ]);
    });
  });

  describe('PricesProviderSchema', () => {
    it('should validate a valid prices provider', () => {
      const pricesProvider = pricesProviderBuilder().build();

      const result = PricesProviderSchema.safeParse(pricesProvider);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid prices provider chainName', () => {
      const pricesProvider = pricesProviderBuilder()
        .with('chainName', faker.number.int() as unknown as string)
        .build();

      const result = PricesProviderSchema.safeParse(pricesProvider);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['chainName'],
          message: 'Invalid input: expected string, received number',
        },
      ]);
    });

    it('should not validate an invalid prices provider nativeCoin', () => {
      const pricesProvider = pricesProviderBuilder()
        .with('nativeCoin', faker.number.int() as unknown as string)
        .build();

      const result = PricesProviderSchema.safeParse(pricesProvider);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['nativeCoin'],
          message: 'Invalid input: expected string, received number',
        },
      ]);
    });
  });

  describe('BalancesProviderSchema', () => {
    it('should validate a valid BalancesProvider', () => {
      const balancesProvider = balancesProviderBuilder().build();

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid balancesProvider chainName', () => {
      const balancesProvider = balancesProviderBuilder().build();
      // @ts-expect-error - chainName is expected to be a string
      balancesProvider.chainName = faker.number.int();

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['chainName'],
          message: 'Invalid input: expected string, received number',
        },
      ]);
    });

    it('should default balancesProvider chainName to null', () => {
      const balancesProvider = balancesProviderBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete balancesProvider.chainName;

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(result.success && result.data.chainName).toStrictEqual(null);
    });

    it('should not validate an undefined balancesProvider enablement status', () => {
      const balancesProvider = balancesProviderBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete balancesProvider.enabled;

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'boolean',
          path: ['enabled'],
          message: 'Invalid input: expected boolean, received undefined',
        },
      ]);
    });

    it('should not validate an invalid balancesProvider enablement status', () => {
      const balancesProvider = balancesProviderBuilder().build();
      // @ts-expect-error - enabled is expected to be a boolean
      balancesProvider.enabled = 'true';

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'boolean',
          path: ['enabled'],
          message: 'Invalid input: expected boolean, received string',
        },
      ]);
    });
  });

  describe('ContractAddressesSchema', () => {
    it('should validate a valid ContractAddresses', () => {
      const contractAddresses = contractAddressesBuilder().build();

      const result = ContractAddressesSchema.safeParse(contractAddresses);

      expect(result.success).toBe(true);
    });

    [
      'safeSingletonAddress' as const,
      'safeProxyFactoryAddress' as const,
      'multiSendAddress' as const,
      'multiSendCallOnlyAddress' as const,
      'fallbackHandlerAddress' as const,
      'signMessageLibAddress' as const,
      'createCallAddress' as const,
      'simulateTxAccessorAddress' as const,
      'safeWebAuthnSignerFactoryAddress' as const,
    ].forEach((field) => {
      it(`should checksum the ${field}`, () => {
        const contractAddresses = contractAddressesBuilder()
          .with(field, faker.finance.ethereumAddress().toLowerCase() as Address)
          .build();

        const result = ContractAddressesSchema.safeParse(contractAddresses);

        expect(result.success && result.data[field]).toBe(
          getAddress(contractAddresses[field]!),
        );
      });

      it(`should allow undefined ${field} and default to null`, () => {
        const contractAddresses = contractAddressesBuilder().build();
        delete contractAddresses[field];

        const result = ContractAddressesSchema.safeParse(contractAddresses);

        expect(result.success && result.data[field]).toBe(null);
      });
    });
  });

  describe('ChainSchema', () => {
    it('should validate a valid chain', () => {
      const chain = chainBuilder().build();

      const result = ChainSchema.safeParse(chain);

      expect(result.success).toBe(true);
    });

    // TODO: Remove after Config Service is deployed
    // @see https://github.com/safe-global/safe-config-service/pull/1339
    it('should default zk to false', () => {
      const chain = chainBuilder().build();
      // @ts-expect-error - zk is expected to be a boolean
      delete chain.zk;

      const result = ChainSchema.safeParse(chain);

      expect(result.success && result.data.zk).toBe(false);
    });

    it.each([['chainLogoUri' as const], ['ensRegistryAddress' as const]])(
      'should allow undefined %s and default to null',
      (field) => {
        const chain = chainBuilder().build();
        delete chain[field];

        const result = ChainSchema.safeParse(chain);

        expect(result.success && result.data[field]).toBe(null);
      },
    );

    it.each(['transactionService' as const, 'vpcTransactionService' as const])(
      'accept non-trailing slash %s as is',
      (field) => {
        const url = faker.internet.url({ appendSlash: false });
        const chain = chainBuilder().with(field, url).build();

        const result = ChainSchema.safeParse(chain);

        expect(result.success && result.data[field]).toBe(url);
      },
    );

    it.each(['transactionService' as const, 'vpcTransactionService' as const])(
      'should remove trailing slashes from %s',
      (field) => {
        const url = faker.internet.url({ appendSlash: false });
        const chain = chainBuilder().with(field, `${url}/`).build();

        const result = ChainSchema.safeParse(chain);

        expect(result.success && result.data[field]).toBe(url);
      },
    );

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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          path: [field],
          message: 'Invalid input: expected string, received undefined',
        },
      ]);
    });

    it.each([
      ['rpcUri' as const],
      ['safeAppsRpcUri' as const],
      ['publicRpcUri' as const],
      ['blockExplorerUriTemplate' as const],
      ['beaconChainExplorerUriTemplate' as const],
      ['contractAddresses' as const],
      ['nativeCurrency' as const],
      ['pricesProvider' as const],
      ['balancesProvider' as const],
      ['theme' as const],
      // TODO: Include after Config Service is deployed
      // @see https://github.com/safe-global/safe-config-service/pull/1339
      // ['zk' as const]
    ])('should not validate a chain without %s', (field) => {
      const chain = chainBuilder().build();
      delete chain[field];

      const result = ChainSchema.safeParse(chain);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          path: [field],
          message: 'Invalid input: expected object, received undefined',
        },
      ]);
    });
  });

  describe('ChainLenientPageSchema', () => {
    it('should validate a valid Chain page', () => {
      const chains = faker.helpers.multiple(() => chainBuilder().build(), {
        count: { min: 1, max: 5 },
      });
      const chainPage = pageBuilder()
        .with('results', chains)
        .with('count', chains.length)
        .build();

      const result = ChainLenientPageSchema.safeParse(chainPage);

      expect(result.success).toBe(true);
    });

    it('should exclude invalid Chain items', () => {
      const chains = faker.helpers.multiple(() => chainBuilder().build(), {
        count: { min: 1, max: 5 },
      });
      const chainPage = pageBuilder<Chain>()
        .with('results', chains)
        .with('count', chains.length)
        .build();
      // @ts-expect-error - results are assumed optional
      delete chainPage.results[0].chainId;

      const result = ChainLenientPageSchema.safeParse(chainPage);

      expect(result.success).toBe(true);
    });
  });
});
