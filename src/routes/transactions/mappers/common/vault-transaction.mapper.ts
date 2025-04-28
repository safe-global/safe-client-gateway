import { DefiVaultStatsAdditionalReward } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  VaultDepositAdditionalRewards,
  VaultDepositTransactionInfo,
} from '@/routes/transactions/entities/vaults/vault-deposit-info.entity';
import { VaultWithdrawTransactionInfo } from '@/routes/transactions/entities/vaults/vault-withdraw-info.entity';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class VaultTransactionMapper {
  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    assets: number;
    data: `0x${string}`;
  }): Promise<VaultDepositTransactionInfo> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });
    this.validateDeployment({ chainId: args.chainId, deployment });
    const defiVaultStats = await this.stakingRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });
    const token = await this.tokenRepository.getToken({
      chainId: args.chainId,
      address: defiVaultStats.asset,
    });
    const additionalRewards = await this.mapAdditionalRewards({
      chainId: args.chainId,
      additionalRewards: defiVaultStats.additional_rewards,
    });
    const value = (args.assets ?? 0) / 10 ** token.decimals;
    const fee = deployment.product_fee ? Number(deployment.product_fee) : 0;
    const nrr = defiVaultStats.nrr * (1 - fee);
    const expectedAnnualReward = (nrr / 100) * value;
    const expectedMonthlyReward = expectedAnnualReward / 12;
    return new VaultDepositTransactionInfo({
      chainId: args.chainId,
      expectedMonthlyReward,
      expectedAnnualReward,
      value,
      tokenInfo: new TokenInfo({ ...token, trusted: true }),
      returnRate: nrr,
      vaultAddress: args.to,
      vaultName: defiVaultStats.vault,
      vaultDisplayName: deployment.display_name,
      vaultDescription: deployment.description,
      vaultDashboardURL: deployment.external_links?.deposit_url ?? null,
      vaultTVL: Number(defiVaultStats.tvl),
      additionalRewards,
    });
  }

  public async mapWithdrawInfo(args: {
    chainId: string;
    to: `0x${string}`;
    assets: number;
    data: `0x${string}`;
  }): Promise<VaultWithdrawTransactionInfo> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });
    this.validateDeployment({ chainId: args.chainId, deployment });
    return new VaultWithdrawTransactionInfo();
  }

  private async mapAdditionalRewards(args: {
    chainId: string;
    additionalRewards: Array<DefiVaultStatsAdditionalReward> | null;
  }): Promise<Array<VaultDepositAdditionalRewards>> {
    if (!args.additionalRewards) {
      return Promise.resolve([]);
    }
    const rewards = [];
    for (const reward of args.additionalRewards) {
      const token = await this.tokenRepository
        .getToken({
          chainId: args.chainId,
          address: reward.asset,
        })
        .catch(() => null);
      if (token && reward.nrr) {
        rewards.push(
          new VaultDepositAdditionalRewards({
            tokenInfo: new TokenInfo({ ...token, trusted: true }),
            returnRate: reward.nrr,
          }),
        );
      }
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
