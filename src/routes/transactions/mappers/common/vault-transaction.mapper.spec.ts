import {
  defiVaultAdditionalRewardBuilder,
  defiVaultStatsBuilder,
} from '@/datasources/staking-api/entities/__tests__/defi-vault-stats.entity.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import type { StakingRepository } from '@/domain/staking/staking.repository';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import type { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { TransactionInfoType } from '@/routes/transactions/entities/transaction-info.entity';
import { VaultTransactionMapper } from '@/routes/transactions/mappers/common/vault-transaction.mapper';
import { faker } from '@faker-js/faker/.';
import { NotFoundException } from '@nestjs/common';
import { getAddress } from 'viem';

const mockStakingRepository = jest.mocked({
  getDeployment: jest.fn(),
  getDefiVaultStats: jest.fn(),
} as jest.MockedObjectDeep<StakingRepository>);

const mockTokenRepository = {
  getToken: jest.fn(),
} as jest.MockedObjectDeep<ITokenRepository>;

describe('VaultTransactionMapper', () => {
  let target: VaultTransactionMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    target = new VaultTransactionMapper(
      mockStakingRepository,
      mockTokenRepository,
    );
  });

  describe('mapDepositInfo', () => {
    it('should map deposit info correctly', async () => {
      const chain = chainBuilder().build();
      const vaultAddress = getAddress(faker.finance.ethereumAddress());
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('product_fee', '0.1')
        .with('status', 'active')
        .with('chain_id', Number(chain.chainId))
        .build();
      const token = tokenBuilder()
        .with('type', 'ERC20')
        .with('decimals', 2)
        .build();
      const additionalTokens = faker.helpers.multiple(() =>
        tokenBuilder().with('type', 'ERC20').with('decimals', 3).build(),
      );
      const defiVaultStats = defiVaultStatsBuilder()
        .with('asset', token.address)
        .with('tvl', '2000000')
        .with('nrr', 10)
        .with(
          'additional_rewards',
          additionalTokens.map((additionalToken, index) =>
            defiVaultAdditionalRewardBuilder()
              .with('asset', additionalToken.address)
              .with('nrr', index + 1)
              .build(),
          ),
        )
        .build();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getDefiVaultStats.mockResolvedValue(defiVaultStats);
      mockTokenRepository.getToken.mockImplementation((args) => {
        const additionalToken = additionalTokens.find(
          (token) => token.address === args.address,
        );
        if (args.address === token.address) {
          return Promise.resolve(token);
        }
        if (additionalToken) {
          return Promise.resolve(additionalToken);
        }
        throw new Error('Token not found');
      });

      const actual = await target.mapDepositInfo({
        chainId: chain.chainId,
        to: vaultAddress,
        assets: 1_000_000,
        data: '0x',
      });

      expect(actual).toEqual({
        type: TransactionInfoType.VaultDeposit,
        chainId: chain.chainId,
        expectedAnnualReward: 900, // 10 * 0.9 / 100 * 1_000_000 / 10 ** 2,
        expectedMonthlyReward: 75, // 900 / 12,
        humanDescription: null,
        value: 10_000, // 1_000_000 / 10 ** 2
        tokenInfo: new TokenInfo({ ...token, trusted: true }),
        returnRate: 9, // 10 * 0.9
        vaultAddress,
        vaultName: defiVaultStats.vault,
        vaultDisplayName: deployment.display_name,
        vaultDescription: deployment.description,
        vaultDashboardURL: deployment.external_links?.deposit_url ?? null,
        vaultTVL: 2_000_000,
        additionalRewards: additionalTokens.map((additionalToken, index) => ({
          tokenInfo: new TokenInfo({ ...additionalToken, trusted: true }),
          returnRate: index + 1,
        })),
      });
    });

    it('should fail if the deployment product type is not DeFi', async () => {
      const chain = chainBuilder().build();
      const vaultAddress = getAddress(faker.finance.ethereumAddress());
      const deployment = deploymentBuilder()
        .with('product_type', 'pooling')
        .with('product_fee', '0.1')
        .with('status', 'active')
        .with('chain_id', Number(chain.chainId))
        .build();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: vaultAddress,
          assets: faker.number.int(),
          data: '0x',
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });
    it('should fail if the deployment is not active', async () => {
      const chain = chainBuilder().build();
      const vaultAddress = getAddress(faker.finance.ethereumAddress());
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('product_fee', '0.1')
        .with('status', 'disabled')
        .with('chain_id', Number(chain.chainId))
        .build();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: vaultAddress,
          assets: faker.number.int(),
          data: '0x',
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });

    it('should fail if the deployment chainId is different', async () => {
      const chain = chainBuilder().build();
      const vaultAddress = getAddress(faker.finance.ethereumAddress());
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('product_fee', '0.1')
        .with('status', 'active')
        .with('chain_id', faker.number.int())
        .build();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: vaultAddress,
          assets: faker.number.int(),
          data: '0x',
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });
  });
});
