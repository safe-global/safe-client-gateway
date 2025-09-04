import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { AlertsRepository } from '@/domain/alerts/alerts.repository';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts-registration.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import type { Address } from 'viem';

@Injectable()
export class RecoveryService {
  constructor(
    @Inject(IAlertsRepository)
    private readonly alertsRepository: AlertsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
  ) {}

  async addRecoveryModule(args: {
    chainId: string;
    safeAddress: Address;
    addRecoveryModuleDto: AddRecoveryModuleDto;
    authPayload: AuthPayload;
  }): Promise<void> {
    if (
      !args.authPayload.isForChain(args.chainId) ||
      !args.authPayload.signer_address
    ) {
      throw new UnauthorizedException();
    }

    // Check after AuthPayload check to avoid unnecessary request
    const isOwner = await this.safeRepository
      .isOwner({
        safeAddress: args.safeAddress,
        chainId: args.chainId,
        address: args.authPayload.signer_address,
      })
      // Swallow error to avoid leaking information
      .catch(() => false);
    if (!isOwner) {
      throw new UnauthorizedException();
    }

    // After after owner check to avoid unnecessary request
    const isEnabled = await this.safeRepository
      .getSafesByModule({
        chainId: args.chainId,
        moduleAddress: args.addRecoveryModuleDto.moduleAddress,
      })
      .then(({ safes }) => {
        return safes.some((safe) => safe === args.safeAddress);
      })

      // Swallow error to avoid leaking information
      .catch(() => false);
    if (!isEnabled) {
      throw new UnauthorizedException();
    }

    const contract: AlertsRegistration = {
      chainId: args.chainId,
      address: args.addRecoveryModuleDto.moduleAddress,
      displayName: `${args.chainId}:${args.safeAddress}:${args.addRecoveryModuleDto.moduleAddress}`,
    };
    await this.alertsRepository.addContract(contract);
  }

  async deleteRecoveryModule(args: {
    chainId: string;
    moduleAddress: Address;
    safeAddress: Address;
    authPayload: AuthPayload;
  }): Promise<void> {
    if (
      !args.authPayload.isForChain(args.chainId) ||
      !args.authPayload.signer_address
    ) {
      throw new UnauthorizedException();
    }

    // Check after AuthPayload check to avoid unnecessary request
    const isOwner = await this.safeRepository
      .isOwner({
        safeAddress: args.safeAddress,
        chainId: args.chainId,
        address: args.authPayload.signer_address,
      })
      // Swallow error to avoid leaking information
      .catch(() => false);
    if (!isOwner) {
      throw new UnauthorizedException();
    }

    await this.alertsRepository.deleteContract({
      chainId: args.chainId,
      address: args.moduleAddress,
    });
  }
}
