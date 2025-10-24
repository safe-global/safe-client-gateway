import {
  createSlug,
  createAddressSuffix,
  createAssetId,
  AssetIdSchema,
} from '@/domain/common/entities/asset-identifier.entity';

describe('Asset Identifier Utils', () => {
  describe('createSlug', () => {
    it('should convert symbol to lowercase slug', () => {
      expect(createSlug('ETH')).toBe('eth');
      expect(createSlug('DAI')).toBe('dai');
      expect(createSlug('USDC')).toBe('usdc');
    });

    it('should remove special characters', () => {
      expect(createSlug('USD-Coin')).toBe('usdcoin');
      expect(createSlug('Wrapped ETH')).toBe('wrappedeth');
      expect(createSlug('Test_Token')).toBe('testtoken');
    });

    it('should handle mixed case with special characters', () => {
      expect(createSlug('Safe-Token')).toBe('safetoken');
      expect(createSlug('Multi.Word.Token')).toBe('multiwordtoken');
    });

    it('should truncate to 20 characters', () => {
      const longSymbol = 'VeryLongTokenSymbolName';
      expect(createSlug(longSymbol)).toBe('verylongtokensymboln');
      expect(createSlug(longSymbol).length).toBe(20);
    });

    it('should handle empty strings', () => {
      expect(createSlug('')).toBe('');
    });

    it('should handle symbols with only special characters', () => {
      expect(createSlug('!@#$%')).toBe('');
    });
  });

  describe('createAddressSuffix', () => {
    it('should extract first 4 characters after 0x', () => {
      expect(createAddressSuffix('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')).toBe(
        'c02a',
      );
      expect(createAddressSuffix('0x6B175474E89094C44Da98b954EedeAC495271d0F')).toBe(
        '6b17',
      );
    });

    it('should handle uppercase addresses', () => {
      expect(createAddressSuffix('0xABCD1234567890ABCDEF')).toBe('abcd');
    });

    it('should handle addresses without 0x prefix', () => {
      expect(createAddressSuffix('ABCD1234567890')).toBe('abcd');
    });

    it('should handle short addresses', () => {
      expect(createAddressSuffix('0xAB')).toBe('0xab');
      expect(createAddressSuffix('ABC')).toBe('abc');
    });
  });

  describe('createAssetId', () => {
    it('should return base slug when no collision', () => {
      const existingIds = new Set<string>();
      expect(createAssetId('ETH', null, existingIds)).toBe('eth');
      expect(createAssetId('DAI', null, existingIds)).toBe('dai');
    });

    it('should add address suffix on collision', () => {
      const existingIds = new Set(['weth']);
      const address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

      expect(createAssetId('WETH', address, existingIds)).toBe('weth-c02a');
    });

    it('should add counter when address suffix also collides', () => {
      const existingIds = new Set(['weth', 'weth-c02a']);
      const address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

      expect(createAssetId('WETH', address, existingIds)).toBe('weth-c02a-2');
    });

    it('should increment counter until unique', () => {
      const existingIds = new Set(['weth', 'weth-c02a', 'weth-c02a-2']);
      const address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

      expect(createAssetId('WETH', address, existingIds)).toBe('weth-c02a-3');
    });

    it('should use counter fallback when no address provided and collision exists', () => {
      const existingIds = new Set(['dai']);

      expect(createAssetId('DAI', null, existingIds)).toBe('dai-2');
    });

    it('should handle multiple counter collisions without address', () => {
      const existingIds = new Set(['usdc', 'usdc-2', 'usdc-3']);

      expect(createAssetId('USDC', null, existingIds)).toBe('usdc-4');
    });

    it('should handle different tokens with same base slug', () => {
      const existingIds = new Set<string>();

      const eth1 = createAssetId('ETH', null, existingIds);
      existingIds.add(eth1);

      const eth2 = createAssetId(
        'ETH',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        existingIds,
      );
      existingIds.add(eth2);

      const eth3 = createAssetId(
        'ETH',
        '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        existingIds,
      );

      expect(eth1).toBe('eth');
      expect(eth2).toBe('eth-c02a');
      expect(eth3).toBe('eth-6b17');
    });

    it('should create canonical asset ID for first occurrence', () => {
      const existingIds = new Set<string>();

      const dai = createAssetId('DAI', '0x6B175474E89094C44Da98b954EedeAC495271d0F', existingIds);

      expect(dai).toBe('dai');
      expect(existingIds.has('dai')).toBe(false); // Set not modified by function
    });
  });

  describe('AssetIdSchema', () => {
    it('should validate correct asset IDs', () => {
      expect(() => AssetIdSchema.parse('eth')).not.toThrow();
      expect(() => AssetIdSchema.parse('dai')).not.toThrow();
      expect(() => AssetIdSchema.parse('weth-c02a')).not.toThrow();
      expect(() => AssetIdSchema.parse('usdc-2')).not.toThrow();
    });

    it('should reject uppercase asset IDs', () => {
      expect(() => AssetIdSchema.parse('ETH')).toThrow();
      expect(() => AssetIdSchema.parse('Dai')).toThrow();
    });

    it('should reject asset IDs with invalid characters', () => {
      expect(() => AssetIdSchema.parse('eth_token')).toThrow();
      expect(() => AssetIdSchema.parse('dai.token')).toThrow();
      expect(() => AssetIdSchema.parse('usdc token')).toThrow();
    });

    it('should reject empty strings', () => {
      expect(() => AssetIdSchema.parse('')).toThrow();
    });

    it('should reject asset IDs longer than 50 characters', () => {
      const longId = 'a'.repeat(51);
      expect(() => AssetIdSchema.parse(longId)).toThrow();
    });

    it('should accept asset IDs up to 50 characters', () => {
      const maxId = 'a'.repeat(50);
      expect(() => AssetIdSchema.parse(maxId)).not.toThrow();
    });
  });
});
