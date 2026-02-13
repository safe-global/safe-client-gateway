import { ChainsV2Service } from './chains.v2.service';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Page } from '@/domain/entities/page.entity';

describe('ChainsV2Service', () => {
  let service: ChainsV2Service;
  let mockChainsRepository: jest.MockedObjectDeep<IChainsRepository>;

  beforeEach(() => {
    jest.resetAllMocks();

    mockChainsRepository = {
      getChainsV2: jest.fn(),
      getChainV2: jest.fn(),
    } as jest.MockedObjectDeep<IChainsRepository>;

    service = new ChainsV2Service(mockChainsRepository);
  });

  describe('getChains', () => {
    it('should return paginated chains with cursor URLs', async () => {
      const serviceKey = 'WALLET_WEB';
      const routeUrl = new URL(`https://example.com/v2/chains/${serviceKey}`);
      const limit = 10;
      const offset = 0;
      const chains = [
        chainBuilder().with('chainId', '1').build(),
        chainBuilder().with('chainId', '5').build(),
      ];
      const domainPage: Page<Chain> = pageBuilder<Chain>()
        .with('results', chains)
        .with('count', chains.length)
        .with(
          'next',
          `https://config.example.com/api/v2/chains/${serviceKey}?limit=${limit}&offset=${limit}`,
        )
        .with('previous', null)
        .build();

      mockChainsRepository.getChainsV2.mockResolvedValue(domainPage);

      const result = await service.getChains(serviceKey, routeUrl, {
        limit,
        offset,
      });

      expect(result.count).toBe(chains.length);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toBeInstanceOf(Object);
      expect(result.results[0].chainId).toBe('1');
      expect(result.results[1].chainId).toBe('5');
      expect(result.next).toContain('cursor=');
      expect(result.previous).toBeNull();
      expect(mockChainsRepository.getChainsV2).toHaveBeenCalledWith(
        serviceKey,
        limit,
        offset,
      );
    });

    it('should handle chains with ENS registry addresses', async () => {
      const serviceKey = 'WALLET_WEB';
      const routeUrl = new URL(`https://example.com/v2/chains/${serviceKey}`);
      const chain = chainBuilder()
        .with('chainId', '1')
        .with('ensRegistryAddress', faker.finance.ethereumAddress() as Address)
        .build();
      const domainPage: Page<Chain> = pageBuilder<Chain>()
        .with('results', [chain])
        .with('count', 1)
        .with('next', null)
        .with('previous', null)
        .build();

      mockChainsRepository.getChainsV2.mockResolvedValue(domainPage);

      const result = await service.getChains(serviceKey, routeUrl, {
        limit: 10,
        offset: 0,
      });

      if (chain.ensRegistryAddress) {
        expect(result.results[0].ensRegistryAddress?.toLowerCase()).toBe(
          chain.ensRegistryAddress.toLowerCase(),
        );
      }
    });
  });

  describe('getChain', () => {
    it('should return single chain', async () => {
      const serviceKey = 'WALLET_WEB';
      const chainId = '1';
      const chain = chainBuilder().with('chainId', chainId).build();

      mockChainsRepository.getChainV2.mockResolvedValue(chain);

      const result = await service.getChain(serviceKey, chainId);

      expect(result.chainId).toBe(chainId);
      expect(mockChainsRepository.getChainV2).toHaveBeenCalledWith(
        serviceKey,
        chainId,
      );
    });

    it('should handle chain with ENS registry address', async () => {
      const serviceKey = 'WALLET_WEB';
      const chainId = '1';
      const ensAddress = faker.finance.ethereumAddress() as Address;
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('ensRegistryAddress', ensAddress)
        .build();

      mockChainsRepository.getChainV2.mockResolvedValue(chain);

      const result = await service.getChain(serviceKey, chainId);

      if (chain.ensRegistryAddress) {
        expect(result.ensRegistryAddress?.toLowerCase()).toBe(
          chain.ensRegistryAddress.toLowerCase(),
        );
      }
    });
  });
});
