import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import { RecoveryService } from '@/routes/recovery/recovery.service';
import { AddRecoveryModuleDtoSchema } from '@/routes/recovery/entities/schemas/add-recovery-module.dto.schema';
import { EnableRecoveryAlertsGuard } from '@/routes/recovery/guards/enable-recovery-alerts.guard';
import { OnlySafeOwnerGuard } from '@/routes/common/guards/only-safe-owner.guard';
import { TimestampGuard } from '@/routes/email/guards/timestamp.guard';
import { DisableRecoveryAlertsGuard } from '@/routes/recovery/guards/disable-recovery-alerts.guard';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('recovery')
@Controller({
  version: '1',
  path: 'chains/:chainId/safes/:safeAddress/recovery',
})
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @HttpCode(200)
  @Post()
  @UseGuards(
    EnableRecoveryAlertsGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
    OnlySafeOwnerGuard,
  )
  async addRecoveryModule(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(new ValidationPipe(AddRecoveryModuleDtoSchema))
    addRecoveryModuleDto: AddRecoveryModuleDto,
  ): Promise<void> {
    return this.recoveryService.addRecoveryModule({
      chainId,
      safeAddress,
      addRecoveryModuleDto,
    });
  }

  @HttpCode(204)
  @Delete('/:moduleAddress')
  @UseGuards(
    DisableRecoveryAlertsGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
    OnlySafeOwnerGuard,
  )
  async deleteRecoveryModule(
    @Param('chainId') chainId: string,
    @Param('moduleAddress') moduleAddress: string,
  ): Promise<void> {
    return this.recoveryService.deleteRecoveryModule({
      chainId,
      moduleAddress,
    });
  }
}
