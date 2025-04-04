import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { VaultDepositTransactionInfo } from '@/routes/transactions/entities/vaults/vault-deposit-info.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class VaultTransactionMapper {
  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
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
    console.log('deployment', deployment);
    const defiStats = await this.stakingRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });
    console.log('defiStats', defiStats);
    return Promise.resolve(new VaultDepositTransactionInfo(args)); // TODO: mapping
  }
}
