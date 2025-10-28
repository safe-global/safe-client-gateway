import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  BalanceChangeSchema,
  BalanceChangesSchema,
} from '../threat-analysis.types';

describe('ThreatAnalysis Types', () => {
  describe('BalanceChangeSchema', () => {
    it('should parse valid balance change with minimal fields', () => {
      const validBalanceChange = {
        asset: {
          type: 'ERC20',
          address: getAddress(faker.finance.ethereumAddress()),
        },
        in: [{ value: faker.string.numeric(7) }],
        out: [],
      };

      const result = BalanceChangeSchema.parse(validBalanceChange);

      expect(result).toEqual(validBalanceChange);
    });

    it('should parse balance change with optional fields', () => {
      const balanceChangeWithOptionals = {
        asset: {
          type: 'ERC20',
          symbol: 'USDC',
          address: getAddress(faker.finance.ethereumAddress()),
          logo_url: faker.internet.url(),
        },
        in: [{ value: faker.string.numeric(7) }],
        out: [{ value: faker.string.numeric(6) }],
      };

      const result = BalanceChangeSchema.parse(balanceChangeWithOptionals);

      expect(result).toEqual(balanceChangeWithOptionals);
    });

    it('should parse balance change with NFT diffs', () => {
      const nftBalanceChange = {
        asset: {
          type: 'ERC721',
          address: getAddress(faker.finance.ethereumAddress()),
          symbol: 'NFT',
        },
        in: [{ token_id: '0x1a0' }],
        out: [{ token_id: '0xff' }],
      };

      const result = BalanceChangeSchema.parse(nftBalanceChange);

      expect(result).toEqual({
        asset: nftBalanceChange.asset,
        in: [{ token_id: 416 }],
        out: [{ token_id: 255 }],
      });
    });

    it('should parse Blockaid response and strip extra fields', () => {
      const blockaidResponse = {
        asset: {
          type: 'ERC20',
          address: getAddress(faker.finance.ethereumAddress()),
          symbol: 'USDC',
          logo_url: faker.internet.url(),
          decimals: 6,
          name: 'USD Coin',
          verified: true,
        },
        in: [
          {
            value: faker.string.numeric(7),
            usd_price: faker.number.float().toString(),
            summary: faker.lorem.sentence(),
            raw_value: '0x12345',
          },
        ],
        out: [
          {
            value: faker.string.numeric(6),
            usd_price: faker.number.float().toString(),
            summary: faker.lorem.sentence(),
            raw_value: '0x67890',
          },
        ],
        asset_type: 'ERC20',
        balance_changes: {
          before: { value: '1000000', usd_price: '1.00' },
          after: { value: '2000000', usd_price: '2.00' },
        },
      };

      const result = BalanceChangeSchema.parse(blockaidResponse);

      expect(result).toEqual({
        asset: {
          type: 'ERC20',
          address: blockaidResponse.asset.address,
          symbol: 'USDC',
          logo_url: blockaidResponse.asset.logo_url,
        },
        in: [{ value: blockaidResponse.in[0].value }],
        out: [{ value: blockaidResponse.out[0].value }],
      });
    });

    it('should reject invalid asset type', () => {
      const invalidBalanceChange = {
        asset: {
          type: 'INVALID_TYPE',
          address: getAddress(faker.finance.ethereumAddress()),
        },
        in: [],
        out: [],
      };

      expect(() => BalanceChangeSchema.parse(invalidBalanceChange)).toThrow();
    });

    it('should reject missing required fields', () => {
      const missingAsset = {
        in: [],
        out: [],
      };

      expect(() => BalanceChangeSchema.parse(missingAsset)).toThrow();
    });

    it('should reject invalid address format', () => {
      const invalidAddress = {
        asset: {
          type: 'ERC20',
          address: 'invalid-address',
        },
        in: [],
        out: [],
      };

      expect(() => BalanceChangeSchema.parse(invalidAddress)).toThrow();
    });
  });

  describe('BalanceChangesSchema', () => {
    it('should parse array of balance changes', () => {
      const balanceChanges = [
        {
          asset: {
            type: 'ERC20',
            symbol: 'USDC',
            address: getAddress(faker.finance.ethereumAddress()),
          },
          in: [{ value: faker.string.numeric(7) }],
          out: [],
        },
        {
          asset: {
            type: 'NATIVE',
          },
          in: [],
          out: [{ value: faker.string.numeric(18) }],
        },
      ];

      const result = BalanceChangesSchema.parse(balanceChanges);

      expect(result).toEqual(balanceChanges);
      expect(result).toHaveLength(2);
    });

    it('should parse empty array', () => {
      const result = BalanceChangesSchema.parse([]);

      expect(result).toEqual([]);
    });

    it('should parse Blockaid response array and strip extra fields', () => {
      const blockaidResponses = [
        {
          asset: {
            type: 'ERC20',
            address: getAddress(faker.finance.ethereumAddress()),
            symbol: 'USDC',
            decimals: 6,
            name: 'USD Coin',
          },
          in: [
            {
              value: faker.string.numeric(7),
              usd_price: faker.number.float().toString(),
            },
          ],
          out: [],
          asset_type: 'ERC20',
        },
        {
          asset: {
            type: 'ERC20',
            address: getAddress(faker.finance.ethereumAddress()),
            symbol: 'DAI',
            decimals: 18,
            name: 'Dai Stablecoin',
          },
          in: [],
          out: [
            {
              value: faker.string.numeric(10),
              usd_price: faker.number.float().toString(),
            },
          ],
          asset_type: 'ERC20',
        },
      ];

      const result = BalanceChangesSchema.parse(blockaidResponses);

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        asset: {
          type: 'ERC20',
          address: blockaidResponses[0].asset.address,
          symbol: 'USDC',
        },
        in: [{ value: blockaidResponses[0].in[0].value }],
        out: [],
      });

      expect(result[1]).toEqual({
        asset: {
          type: 'ERC20',
          address: blockaidResponses[1].asset.address,
          symbol: 'DAI',
        },
        in: [],
        out: [{ value: blockaidResponses[1].out[0].value }],
      });
    });

    it('should reject array with invalid items', () => {
      const invalidArray = [
        {
          asset: {
            type: 'ERC20',
            address: getAddress(faker.finance.ethereumAddress()),
          },
          in: [],
          out: [],
        },
        {
          in: [],
          out: [],
        },
      ];

      expect(() => BalanceChangesSchema.parse(invalidArray)).toThrow();
    });
  });
});
