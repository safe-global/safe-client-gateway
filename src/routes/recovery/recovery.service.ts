import { Inject, Injectable } from '@nestjs/common';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { AlertsRepository } from '@/domain/alerts/alerts.repository';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts-registration.entity';
import { AlertsDeletion } from '@/domain/alerts/entities/alerts-deletion.entity';
import { DeleteRecoveryModuleDto } from '@/routes/recovery/entities/delete-recovery-module.dto.entity';

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
    const contract: AlertsRegistration = {
      chainId: args.chainId,
      address: args.addRecoveryModuleDto.moduleAddress,
      displayName: `${args.chainId}:${args.safeAddress}:${args.addRecoveryModuleDto.moduleAddress}`,
    };
    await this.alertsRepository.addContract(contract);
  }

  async deleteRecoveryModule(args: {
    chainId: string;
    deleteRecoveryModuleDto: DeleteRecoveryModuleDto;
  }): Promise<void> {
    const contract: AlertsDeletion = {
      chainId: args.chainId,
      address: args.deleteRecoveryModuleDto.moduleAddress,
    };
    await this.alertsRepository.deleteContract(contract);
  }
}
