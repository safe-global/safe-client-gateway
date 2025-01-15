import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  assetByProtocolBuilder,
  assetByProtocolChainBuilder,
  complexPositionBuilder,
  complexPositionPositionBuilder,
  portfolioAssetBuilder,
  portfolioBuilder,
  protocolPositionsBuilder,
  regularPositionBuilder,
} from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import {
  AssetByProtocolChainSchema,
  AssetByProtocolSchema,
  ComplexPositionPositionSchema,
  ComplexPositionSchema,
  PortfolioAssetSchema,
  PortfolioSchema,
  ProtocolPositionsSchema,
  RegularPositionSchema,
} from '@/domain/portfolio/entities/portfolio.entity';
import type {
  ComplexPositionPosition,
  PortfolioAsset,
  ProtocolChainKeys,
  ProtocolPositionType,
} from '@/domain/portfolio/entities/portfolio.entity';

describe('Portfolio', () => {
  describe('PortfolioAssetSchema', () => {
    it('should validate a PortfolioAsset', () => {
      const portfolioAssets = portfolioAssetBuilder().build();

      const result = PortfolioAssetSchema.safeParse(portfolioAssets);

      expect(result.success).toBe(true);
    });

    it.each<keyof PortfolioAsset>(['balance', 'price', 'value'])(
      `should not allow a non-numerical %s`,
      (key) => {
        const portfolioAssets = portfolioAssetBuilder()
          .with(key, faker.string.alpha())
          .build();

        const result = PortfolioAssetSchema.safeParse(portfolioAssets);

        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'custom',
            message: 'Invalid base-10 numeric string',
            path: [key],
          },
        ]);
      },
    );

    it('should coerce the decimal to a number', () => {
      const portfolioAssets = portfolioAssetBuilder()
        .with('decimal', faker.string.numeric() as unknown as number)
        .build();

      const result = PortfolioAssetSchema.safeParse(portfolioAssets);

      expect(result.success && result.data.decimal).toBe(
        Number(portfolioAssets.decimal),
      );
    });

    it('should not allow a non-address contract', () => {
      const portfolioAssets = portfolioAssetBuilder()
        .with('contract', faker.string.alpha() as `0x${string}`)
        .build();

      const result = PortfolioAssetSchema.safeParse(portfolioAssets);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid address',
          path: ['contract'],
        },
      ]);
    });

    it('should checksum the contract address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const portfolioAssets = portfolioAssetBuilder()
        .with('contract', nonChecksummedAddress)
        .build();

      const result = PortfolioAssetSchema.safeParse(portfolioAssets);

      expect(result.success && result.data.contract).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should not allow a non-url imgSmall', () => {
      const portfolioAssets = portfolioAssetBuilder()
        .with('imgSmall', faker.string.sample())
        .build();

      const result = PortfolioAssetSchema.safeParse(portfolioAssets);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['imgSmall'],
          validation: 'url',
        },
      ]);
    });

    it('should not validate an invalid PortfolioAsset', () => {
      const portfolioAssets = { invalid: 'portfolioAsset' };

      const result = PortfolioAssetSchema.safeParse(portfolioAssets);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['balance'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Expected number, received nan',
          path: ['decimal'],
          received: 'nan',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['name'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['price'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['symbol'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['value'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['contract'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['imgSmall'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('RegularPositionSchema', () => {
    it('should validate a RegularPosition', () => {
      const regularPosition = regularPositionBuilder().build();

      const result = RegularPositionSchema.safeParse(regularPosition);

      expect(result.success).toBe(true);
    });

    it('should not allow a non-numerical totalValue', () => {
      const regularPosition = regularPositionBuilder()
        .with('totalValue', faker.string.alpha())
        .build();

      const result = RegularPositionSchema.safeParse(regularPosition);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['totalValue'],
        },
      ]);
    });

    it('should not validate an invalid RegularPosition', () => {
      const regularPosition = { invalid: 'regularPosition' };

      const result = RegularPositionSchema.safeParse(regularPosition);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['name'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Required',
          path: ['assets'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['totalValue'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('ComplexPositionPositionSchema', () => {
    it('should validate a ComplexPositionPosition', () => {
      const complexPositionPosition = complexPositionPositionBuilder().build();

      const result = ComplexPositionPositionSchema.safeParse(
        complexPositionPosition,
      );

      expect(result.success).toBe(true);
    });

    it.each<keyof ComplexPositionPosition>(['value', 'healthRate'])(
      'should not allow a non-numerical %s',
      (key) => {
        const complexPositionPosition = complexPositionPositionBuilder()
          .with(key, faker.string.alpha())
          .build();

        const result = ComplexPositionPositionSchema.safeParse(
          complexPositionPosition,
        );

        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'custom',
            message: 'Invalid base-10 numeric string',
            path: [key],
          },
        ]);
      },
    );

    it('should not validate an invalid ComplexPositionPosition', () => {
      const complexPositionPosition = { invalid: 'complexPositionPosition' };

      const result = ComplexPositionPositionSchema.safeParse(
        complexPositionPosition,
      );

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['name'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['value'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Required',
          path: ['assets'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('ComplexPositionSchema', () => {
    it('should validate a ComplexPosition', () => {
      const complexPosition = complexPositionBuilder().build();

      const result = ComplexPositionSchema.safeParse(complexPosition);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid ComplexPosition', () => {
      const complexPosition = { invalid: 'complexPosition' };

      const result = ComplexPositionSchema.safeParse(complexPosition);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['name'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Required',
          path: ['protocolPositions'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('ProtocolPositionsSchema', () => {
    it('should validate a ProtocolPosition', () => {
      const protocolPositions = protocolPositionsBuilder().build();

      const result = ProtocolPositionsSchema.safeParse(protocolPositions);

      expect(result.success).toBe(true);
    });

    it('should not allow an unknown position type', () => {
      const type = faker.word.verb() as (typeof ProtocolPositionType)[number];
      const protocolPositions = protocolPositionsBuilder()
        .with(
          type,
          faker.datatype.boolean()
            ? regularPositionBuilder().build()
            : complexPositionBuilder().build(),
        )
        .build();

      const result = ProtocolPositionsSchema.safeParse(protocolPositions);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_enum_value',
          message: `Invalid enum value. Expected 'DEPOSIT' | 'FARMING' | 'GOVERNANCE' | 'INSURANCEBUYER' | 'INSURANCESELLER' | 'INVESTMENT' | 'LENDING' | 'LEVERAGE' | 'LEVERAGED FARMING' | 'LIQUIDITYPOOL' | 'LOCKED' | 'MARGIN' | 'MARGINPS' | 'NFTBORROWER' | 'NFTFRACTION' | 'NFTLENDER' | 'NFTLENDING' | 'NFTLIQUIDITYPOOL' | 'NFTSTAKED' | 'OPTIONSBUYER' | 'OPTIONSSELLER' | 'PERPETUALS' | 'REWARDS' | 'SPOT' | 'STAKED' | 'VAULT' | 'VAULTPS' | 'VESTING' | 'WALLET' | 'YIELD', received '${type}'`,
          options: [
            'DEPOSIT',
            'FARMING',
            'GOVERNANCE',
            'INSURANCEBUYER',
            'INSURANCESELLER',
            'INVESTMENT',
            'LENDING',
            'LEVERAGE',
            'LEVERAGED FARMING',
            'LIQUIDITYPOOL',
            'LOCKED',
            'MARGIN',
            'MARGINPS',
            'NFTBORROWER',
            'NFTFRACTION',
            'NFTLENDER',
            'NFTLENDING',
            'NFTLIQUIDITYPOOL',
            'NFTSTAKED',
            'OPTIONSBUYER',
            'OPTIONSSELLER',
            'PERPETUALS',
            'REWARDS',
            'SPOT',
            'STAKED',
            'VAULT',
            'VAULTPS',
            'VESTING',
            'WALLET',
            'YIELD',
          ],
          path: [type],
          received: type,
        },
      ]);
    });

    it('should not validate an invalid ProtocolPosition', () => {
      const protocolPositions = { invalid: 'protocolPositions' };

      const result = ComplexPositionPositionSchema.safeParse(protocolPositions);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['name'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['value'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Required',
          path: ['assets'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('AssetByProtocolChainSchema', () => {
    it('should validate an AssetByProtocolChain', () => {
      const assetByProtocolChain = assetByProtocolChainBuilder().build();

      const result = AssetByProtocolChainSchema.safeParse(assetByProtocolChain);

      expect(result.success).toBe(true);
    });

    it('should not allow an unknown position chain key', () => {
      const key = faker.word.noun() as (typeof ProtocolChainKeys)[number];
      const assetByProtocolChain = assetByProtocolChainBuilder()
        .with(key, {
          protocolPositions: protocolPositionsBuilder().build(),
        })
        .build();

      const result = AssetByProtocolChainSchema.safeParse(assetByProtocolChain);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_enum_value',
          message: `Invalid enum value. Expected 'ancient8' | 'arbitrum' | 'arbitrum_nova' | 'aurora' | 'avalanche' | 'base' | 'binance' | 'blast' | 'bob' | 'boba' | 'celo' | 'core' | 'cronos' | 'era' | 'ethereum' | 'fantom' | 'fraxtal' | 'gnosis' | 'hyperliquid' | 'kava' | 'kroma' | 'linea' | 'manta' | 'mantle' | 'metis' | 'mint' | 'mode' | 'optimism' | 'polygon' | 'polygon_zkevm' | 'rari' | 'scroll' | 'solana' | 'taiko' | 'wc' | 'xlayer' | 'zora', received '${key}'`,
          options: [
            'ancient8',
            'arbitrum',
            'arbitrum_nova',
            'aurora',
            'avalanche',
            'base',
            'binance',
            'blast',
            'bob',
            'boba',
            'celo',
            'core',
            'cronos',
            'era',
            'ethereum',
            'fantom',
            'fraxtal',
            'gnosis',
            'hyperliquid',
            'kava',
            'kroma',
            'linea',
            'manta',
            'mantle',
            'metis',
            'mint',
            'mode',
            'optimism',
            'polygon',
            'polygon_zkevm',
            'rari',
            'scroll',
            'solana',
            'taiko',
            'wc',
            'xlayer',
            'zora',
          ],
          path: [key],
          received: key,
        },
      ]);
    });

    it('should not validate an invalid AssetByProtocolChain', () => {
      const assetByProtocolChain = { invalid: 'assetByProtocolChain' };

      const result = AssetByProtocolChainSchema.safeParse(assetByProtocolChain);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_enum_value',
          message:
            "Invalid enum value. Expected 'ancient8' | 'arbitrum' | 'arbitrum_nova' | 'aurora' | 'avalanche' | 'base' | 'binance' | 'blast' | 'bob' | 'boba' | 'celo' | 'core' | 'cronos' | 'era' | 'ethereum' | 'fantom' | 'fraxtal' | 'gnosis' | 'hyperliquid' | 'kava' | 'kroma' | 'linea' | 'manta' | 'mantle' | 'metis' | 'mint' | 'mode' | 'optimism' | 'polygon' | 'polygon_zkevm' | 'rari' | 'scroll' | 'solana' | 'taiko' | 'wc' | 'xlayer' | 'zora', received 'invalid'",
          options: [
            'ancient8',
            'arbitrum',
            'arbitrum_nova',
            'aurora',
            'avalanche',
            'base',
            'binance',
            'blast',
            'bob',
            'boba',
            'celo',
            'core',
            'cronos',
            'era',
            'ethereum',
            'fantom',
            'fraxtal',
            'gnosis',
            'hyperliquid',
            'kava',
            'kroma',
            'linea',
            'manta',
            'mantle',
            'metis',
            'mint',
            'mode',
            'optimism',
            'polygon',
            'polygon_zkevm',
            'rari',
            'scroll',
            'solana',
            'taiko',
            'wc',
            'xlayer',
            'zora',
          ],
          path: ['invalid'],
          received: 'invalid',
        },
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Expected object, received string',
          path: ['invalid'],
          received: 'string',
        },
      ]);
    });
  });

  describe('AssetByProtocolSchema', () => {
    it('should validate an AssetByProtocol', () => {
      const assetByProtocol = assetByProtocolBuilder().build();

      const result = AssetByProtocolSchema.safeParse(assetByProtocol);

      expect(result.success).toBe(true);
    });

    it('should not allow a non-url imgLarge', () => {
      const assetByProtocol = assetByProtocolBuilder()
        .with('imgLarge', faker.string.sample())
        .build();

      const result = AssetByProtocolSchema.safeParse(assetByProtocol);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['imgLarge'],
          validation: 'url',
        },
      ]);
    });

    it('should not allow a non-numerical value', () => {
      const assetByProtocol = assetByProtocolBuilder()
        .with('value', faker.string.alpha())
        .build();

      const result = AssetByProtocolSchema.safeParse(assetByProtocol);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['value'],
        },
      ]);
    });

    it('should not validate an invalid AssetByProtocol', () => {
      const assetByProtocol = { invalid: 'assetByProtocol' };

      const result = AssetByProtocolSchema.safeParse(assetByProtocol);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Required',
          path: ['chains'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['name'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['imgLarge'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['value'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('PortfolioSchema', () => {
    it('should validate a Portfolio', () => {
      const portfolio = portfolioBuilder().build();

      const result = PortfolioSchema.safeParse(portfolio);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid Portfolio', () => {
      const portfolio = { invalid: 'portfolio' };

      const result = PortfolioSchema.safeParse(portfolio);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'undefined',
          path: ['assetByProtocols'],
          message: 'Required',
        },
      ]);
    });
  });
});
