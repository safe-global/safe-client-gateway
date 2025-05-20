import {
  DefiVaultStats,
  DefiVaultStatsAdditionalReward,
} from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { EarnRepository } from '@/domain/earn/earn.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { VaultExtraReward } from '@/routes/transactions/entities/vaults/vault-extra-reward.entity';
import { VaultInfo } from '@/routes/transactions/entities/vaults/vault-info.entity';
import {
  VaultDepositTransactionInfo,
  VaultRedeemTransactionInfo as VaultRedeemTransactionInfo,
} from '@/routes/transactions/entities/vaults/vault-transaction-info.entity';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class VaultTransactionMapper {
  constructor(
    @Inject(EarnRepository)
    private readonly earnRepository: EarnRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    assets: number;
    data: `0x${string}`;
    safeAddress: `0x${string}`;
  }): Promise<VaultDepositTransactionInfo> {
    const deployment = await this.earnRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });
    this.validateDeployment({ chainId: args.chainId, deployment });
    const defiVaultStats = await this.earnRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });
    const [token, additionalRewards] = await Promise.all([
      this.tokenRepository.getToken({
        chainId: args.chainId,
        address: defiVaultStats.asset,
      }),
      this.mapAdditionalRewards({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        additionalRewards: defiVaultStats.additional_rewards,
      }),
    ]);

    const cumulativeNrr =
      defiVaultStats.nrr + defiVaultStats.additional_rewards_nrr;
    const expectedAnnualReward = (cumulativeNrr / 100) * args.assets;
    const expectedMonthlyReward = expectedAnnualReward / 12;

    return new VaultDepositTransactionInfo({
      value: getNumberString(args.assets),
      fee: defiVaultStats.performance_fee,
      baseNrr: defiVaultStats.nrr,
      tokenInfo: new TokenInfo({ ...token, trusted: true }),
      vaultInfo: this.mapVaultInfo({ deployment, defiVaultStats }),
      currentReward: '0',
      expectedMonthlyReward: getNumberString(expectedMonthlyReward),
      expectedAnnualReward: getNumberString(expectedAnnualReward),
      additionalRewardsNrr: defiVaultStats.additional_rewards_nrr,
      additionalRewards,
    });
  }

  public async mapRedeemInfo(args: {
    chainId: string;
    to: `0x${string}`;
    assets: number;
    data: `0x${string}`;
    safeAddress: `0x${string}`;
  }): Promise<VaultRedeemTransactionInfo> {
    const deployment = await this.earnRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });
    this.validateDeployment({ chainId: args.chainId, deployment });
    const defiVaultStats = await this.earnRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });
    const [token, additionalRewards, stake] = await Promise.all([
      this.tokenRepository.getToken({
        chainId: args.chainId,
        address: defiVaultStats.asset,
      }),
      this.mapAdditionalRewards({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        additionalRewards: defiVaultStats.additional_rewards,
      }),
      this.earnRepository.getDefiVaultStake({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        vault: args.to,
      }),
    ]);

    const currentReward = Number(stake.current_rewards);

    return new VaultRedeemTransactionInfo({
      value: getNumberString(args.assets),
      fee: defiVaultStats.performance_fee,
      baseNrr: defiVaultStats.nrr,
      tokenInfo: new TokenInfo({ ...token, trusted: true }),
      vaultInfo: this.mapVaultInfo({ deployment, defiVaultStats }),
      currentReward: getNumberString(currentReward),
      additionalRewardsNrr: defiVaultStats.additional_rewards_nrr,
      additionalRewards,
    });
  }

  private mapVaultInfo(args: {
    deployment: Deployment;
    defiVaultStats: DefiVaultStats;
  }): VaultInfo {
    return new VaultInfo({
      address: args.deployment.address,
      name: args.deployment.display_name,
      description: args.deployment.description,
      dashboardUri: args.deployment.external_links?.deposit_url ?? null,
      logoUri: args.defiVaultStats.protocol_icon,
    });
  }

  private async mapAdditionalRewards(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    additionalRewards: Array<DefiVaultStatsAdditionalReward> | null;
  }): Promise<Array<VaultExtraReward>> {
    if (!args.additionalRewards) {
      return [];
    }

    const morphoExtraRewards = await this.earnRepository
      .getDefiMorphoExtraRewards(args)
      .catch(() => []);

    const rewards = [];
    for (const reward of args.additionalRewards) {
      const token = await this.tokenRepository
        .getToken({
          chainId: args.chainId,
          address: reward.asset,
        })
        .catch(() => null);

      if (!token) {
        continue;
      }

      const morphoExtraReward = morphoExtraRewards.find((extraReward) => {
        return extraReward.asset === reward.asset;
      });

      rewards.push(
        new VaultExtraReward({
          tokenInfo: new TokenInfo({ ...token, trusted: true }),
          nrr: reward.nrr,
          claimable: morphoExtraReward?.claimable ?? '0',
          claimableNext: morphoExtraReward?.claimable_next ?? '0',
        }),
      );
    }

    return rewards;
  }

  private validateDeployment(args: {
    chainId: string;
    deployment: Deployment;
  }): void {
    if (
      args.deployment.product_type !== 'defi' ||
      args.deployment.status !== 'active' ||
      args.deployment.chain_id.toString() !== args.chainId
    ) {
      throw new NotFoundException('DeFi deployment not found');
    }
  }
}
