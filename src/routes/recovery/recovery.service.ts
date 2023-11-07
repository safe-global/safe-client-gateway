import { Inject, Injectable } from '@nestjs/common';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { AlertsRepository } from '@/domain/alerts/alerts.repository';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import { Contract } from '@/domain/alerts/entities/alerts.entity';

@Injectable()
export class RecoveryService {
  constructor(
    @Inject(IAlertsRepository)
    private readonly alertsRepository: AlertsRepository,
  ) {}

  async addRecoveryModule(args: {
    chainId: string;
    safeAddress: string;
    addRecoveryModuleDto: AddRecoveryModuleDto;
  }): Promise<void> {
    const contract: Contract = {
      chainId: args.chainId,
      address: args.addRecoveryModuleDto.moduleAddress,
      displayName: this.getDisplayName(args),
    };
    await this.alertsRepository.addContracts([contract]);
  }

  private getDisplayName(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}:${args.safeAddress}`;
  }
}
