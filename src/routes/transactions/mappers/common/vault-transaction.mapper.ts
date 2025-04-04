import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { VaultDepositTransactionInfo } from '@/routes/transactions/entities/vaults/vault-deposit-info.entity';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class VaultTransactionMapper {
  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: TokenRepository,
  ) {}

  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    value: string;
    data: `0x${string}`;
  }): Promise<VaultDepositTransactionInfo> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });
    this.validateDeployment({ chainId: args.chainId, deployment });
    const defiStats = await this.stakingRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });
    const underlyingToken = await this.tokenRepository.getToken({
      chainId: args.chainId,
      address: defiStats.asset,
    });
    const value = args.value ? Number(args.value) : 0;
    const fee = deployment.product_fee ? Number(deployment.product_fee) : 0;
    const nrr = defiStats.nrr * (1 - fee);
    const expectedAnnualReward = (nrr / 100) * value;
    const expectedMonthlyReward = expectedAnnualReward / 12;
    const vaultDepositTransactionInfo = new VaultDepositTransactionInfo({
      chainId: args.chainId,
      expectedMonthlyReward,
      expectedAnnualReward,
      tokenInfo: new TokenInfo({
        address: underlyingToken.address,
        decimals: underlyingToken.decimals,
        logoUri: underlyingToken.logoUri,
        name: underlyingToken.name,
        symbol: underlyingToken.symbol,
        trusted: true,
      }),
      returnRate: nrr,
      vaultAddress: args.to,
      vaultName: defiStats.vault,
      vaultDisplayName: deployment.display_name,
      vaultDescription: deployment.description,
      vaultDashboardURL: deployment.external_links?.deposit_url ?? null,
      vaultTVL: Number(defiStats.tvl),
    });

    return vaultDepositTransactionInfo;
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
