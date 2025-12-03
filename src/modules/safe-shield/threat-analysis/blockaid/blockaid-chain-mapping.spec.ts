import {
  CHAIN_ID_TO_BLOCKAID_CHAIN,
  getBlockaidChainName,
} from './blockaid-chain-mapping';

describe('blockaid-chain-mapping', () => {
  describe('CHAIN_ID_TO_BLOCKAID_CHAIN', () => {
    it('should have mappings for supported chains', () => {
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['1']).toBe('ethereum');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['10']).toBe('optimism');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['56']).toBe('bsc');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['100']).toBe('gnosis');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['137']).toBe('polygon');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['324']).toBe('zksync');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['8453']).toBe('base');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['42161']).toBe('arbitrum');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['43114']).toBe('avalanche');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['59144']).toBe('linea');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['81457']).toBe('blast');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['534352']).toBe('scroll');
      expect(CHAIN_ID_TO_BLOCKAID_CHAIN['11155111']).toBe('ethereum-sepolia');
    });
  });

  describe('getBlockaidChainName', () => {
    it('should return the correct chain name for supported chains', () => {
      expect(getBlockaidChainName('1')).toBe('ethereum');
      expect(getBlockaidChainName('10')).toBe('optimism');
      expect(getBlockaidChainName('42161')).toBe('arbitrum');
    });

    it('should return null for unsupported chains', () => {
      expect(getBlockaidChainName('999999')).toBeNull();
      expect(getBlockaidChainName('0')).toBeNull();
      expect(getBlockaidChainName('')).toBeNull();
    });
  });
});
