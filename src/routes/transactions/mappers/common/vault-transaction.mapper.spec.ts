import { defiMorphoExtraRewardBuilder } from '@/datasources/staking-api/entities/__tests__/defi-morpho-extra-reward.entity.builder';
import { defiVaultStakeBuilder } from '@/datasources/staking-api/entities/__tests__/defi-vault-state.entity.builder';
import {
  defiVaultAdditionalRewardBuilder,
  defiVaultStatsBuilder,
} from '@/datasources/staking-api/entities/__tests__/defi-vault-stats.entity.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import type { EarnRepository } from '@/domain/earn/earn.repository';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import type { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { TransactionInfoType } from '@/routes/transactions/entities/transaction-info.entity';
import { VaultInfo } from '@/routes/transactions/entities/vaults/vault-info.entity';
import { VaultTransactionMapper } from '@/routes/transactions/mappers/common/vault-transaction.mapper';
import { faker } from '@faker-js/faker/.';
import { NotFoundException } from '@nestjs/common';
import { getAddress } from 'viem';

const mockEarnRepository = jest.mocked({
  getDeployment: jest.fn(),
  getDefiVaultStats: jest.fn(),
  getDefiVaultStake: jest.fn(),
  getDefiMorphoExtraRewards: jest.fn(),
} as jest.MockedObjectDeep<EarnRepository>);

const mockTokenRepository = {
  getToken: jest.fn(),
} as jest.MockedObjectDeep<ITokenRepository>;

describe('VaultTransactionMapper', () => {
  let target: VaultTransactionMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    target = new VaultTransactionMapper(
      mockEarnRepository,
      mockTokenRepository,
    );
  });

  describe('mapDepositInfo', () => {
    it('should map deposit info correctly', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const assets = 1_000_000;
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('status', 'active')
        .with('chain_id', Number(chain.chainId))
        .build();
      const token = tokenBuilder()
        .with('type', 'ERC20')
        .with('decimals', 2)
        .build();
      const additionalTokens = faker.helpers.multiple(
        () => {
          return tokenBuilder()
            .with('type', 'ERC20')
            .with('decimals', 3)
            .build();
        },
        { count: { min: 1, max: 5 } },
      );
      const additionalRewards = additionalTokens.map((additionalToken) => {
        return defiVaultAdditionalRewardBuilder()
          .with('asset', additionalToken.address)
          .build();
      });
      const defiVaultStats = defiVaultStatsBuilder()
        .with('asset', token.address)
        .with('additional_rewards', additionalRewards)
        .build();
      const morphoExtraReward = defiMorphoExtraRewardBuilder()
        .with('asset', additionalRewards[0].asset)
        .build();
      const cumulativeNrr =
        defiVaultStats.nrr + defiVaultStats.additional_rewards_nrr;
      const expectedAnnualReward = (cumulativeNrr / 100) * assets;
      mockEarnRepository.getDeployment.mockResolvedValue(deployment);
      mockEarnRepository.getDefiVaultStats.mockResolvedValue(defiVaultStats);
      mockEarnRepository.getDefiMorphoExtraRewards.mockResolvedValue([
        morphoExtraReward,
      ]);
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
        to: deployment.address,
        assets,
        data,
        safeAddress,
      });

      expect(actual).toEqual({
        type: TransactionInfoType.VaultDeposit,
        humanDescription: null,
        value: assets.toString(),
        fee: defiVaultStats.performance_fee,
        baseNrr: defiVaultStats.nrr,
        tokenInfo: new TokenInfo({ ...token, trusted: true }),
        vaultInfo: new VaultInfo({
          address: deployment.address,
          name: deployment.display_name,
          description: deployment.description,
          dashboardUri: deployment.external_links?.deposit_url ?? null,
          logoUri: defiVaultStats.protocol_icon,
        }),
        currentReward: '0',
        expectedAnnualReward: expectedAnnualReward.toString(),
        expectedMonthlyReward: (expectedAnnualReward / 12).toString(),
        additionalRewardsNrr: defiVaultStats.additional_rewards_nrr,
        additionalRewards: additionalRewards.map((additionalReward) => {
          const token = additionalTokens.find((token) => {
            return token.address === additionalReward.asset;
          });
          if (!token) {
            throw new Error('Token not found');
          }
          const claimable =
            token.address === morphoExtraReward.asset
              ? morphoExtraReward.claimable
              : '0';
          const claimableNext =
            token.address === morphoExtraReward.asset
              ? morphoExtraReward.claimable_next
              : '0';
          return {
            tokenInfo: new TokenInfo({ ...token, trusted: true }),
            nrr: additionalReward.nrr,
            claimable,
            claimableNext,
          };
        }),
      });
    });

    it('should fail if the deployment product type is not DeFi', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const assets = faker.number.int();
      const deployment = deploymentBuilder()
        .with('product_type', 'pooling')
        .with('status', 'active')
        .with('chain_id', Number(chain.chainId))
        .build();
      mockEarnRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: deployment.address,
          assets,
          data,
          safeAddress,
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });

    it('should fail if the deployment is not active', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const assets = faker.number.int();
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('status', 'disabled')
        .with('chain_id', Number(chain.chainId))
        .build();
      mockEarnRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: deployment.address,
          assets,
          data,
          safeAddress,
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });

    it('should fail if the deployment chainId is different', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const assets = faker.number.int();
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('status', 'active')
        .with(
          'chain_id',
          Number(faker.string.numeric({ exclude: [chain.chainId] })),
        )
        .build();
      mockEarnRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: deployment.address,
          assets,
          data,
          safeAddress,
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });
  });

  describe('mapVaultRedeem', () => {
    it('should map redeem info correctly', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const assets = 1_000_000;
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('status', 'active')
        .with('chain_id', Number(chain.chainId))
        .build();
      const token = tokenBuilder()
        .with('type', 'ERC20')
        .with('decimals', 2)
        .build();
      const additionalTokens = faker.helpers.multiple(
        () => {
          return tokenBuilder()
            .with('type', 'ERC20')
            .with('decimals', 3)
            .build();
        },
        { count: { min: 1, max: 5 } },
      );
      const additionalRewards = additionalTokens.map((additionalToken) => {
        return defiVaultAdditionalRewardBuilder()
          .with('asset', additionalToken.address)
          .build();
      });
      const defiVaultStats = defiVaultStatsBuilder()
        .with('asset', token.address)
        .with('additional_rewards', additionalRewards)
        .build();
      const defiVaultStake = defiVaultStakeBuilder().build();
      const morphoExtraReward = defiMorphoExtraRewardBuilder()
        .with('asset', additionalRewards[0].asset)
        .build();
      mockEarnRepository.getDeployment.mockResolvedValue(deployment);
      mockEarnRepository.getDefiVaultStats.mockResolvedValue(defiVaultStats);
      mockEarnRepository.getDefiVaultStake.mockResolvedValue(defiVaultStake);
      mockEarnRepository.getDefiMorphoExtraRewards.mockResolvedValue([
        morphoExtraReward,
      ]);
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

      const actual = await target.mapRedeemInfo({
        chainId: chain.chainId,
        to: deployment.address,
        assets,
        data,
        safeAddress,
      });

      expect(actual).toEqual({
        type: TransactionInfoType.VaultRedeem,
        humanDescription: null,
        value: assets.toString(),
        fee: defiVaultStats.performance_fee,
        baseNrr: defiVaultStats.nrr,
        tokenInfo: new TokenInfo({ ...token, trusted: true }),
        vaultInfo: new VaultInfo({
          address: deployment.address,
          name: deployment.display_name,
          description: deployment.description,
          dashboardUri: deployment.external_links?.deposit_url ?? null,
          logoUri: defiVaultStats.protocol_icon,
        }),
        currentReward: Number(defiVaultStake.current_rewards).toString(),
        additionalRewardsNrr: defiVaultStats.additional_rewards_nrr,
        additionalRewards: additionalRewards.map((additionalReward) => {
          const token = additionalTokens.find((token) => {
            return token.address === additionalReward.asset;
          });
          if (!token) {
            throw new Error('Token not found');
          }
          const claimable =
            token.address === morphoExtraReward.asset
              ? morphoExtraReward.claimable
              : '0';
          const claimableNext =
            token.address === morphoExtraReward.asset
              ? morphoExtraReward.claimable_next
              : '0';
          return {
            tokenInfo: new TokenInfo({ ...token, trusted: true }),
            nrr: additionalReward.nrr,
            claimable,
            claimableNext,
          };
        }),
      });
    });

    it('should fail if the deployment product type is not DeFi', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const assets = faker.number.int();
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('status', 'disabled')
        .with('chain_id', Number(chain.chainId))
        .build();
      mockEarnRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapRedeemInfo({
          chainId: chain.chainId,
          to: deployment.address,
          assets,
          data,
          safeAddress,
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });

    it('should fail if the deployment is not active', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const assets = faker.number.int();
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('status', 'disabled')
        .with('chain_id', Number(chain.chainId))
        .build();
      mockEarnRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapRedeemInfo({
          chainId: chain.chainId,
          to: deployment.address,
          assets,
          data,
          safeAddress,
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });

    it('should fail if the deployment chainId is different', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const assets = faker.number.int();
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('product_fee', '0.1')
        .with('status', 'active')
        .with(
          'chain_id',
          Number(faker.string.numeric({ exclude: [chain.chainId] })),
        )
        .build();
      mockEarnRepository.getDeployment.mockResolvedValue(deployment);

      await expect(
        target.mapRedeemInfo({
          chainId: chain.chainId,
          to: deployment.address,
          assets,
          data,
          safeAddress,
        }),
      ).rejects.toThrow(new NotFoundException('DeFi deployment not found'));
    });
  });
});
