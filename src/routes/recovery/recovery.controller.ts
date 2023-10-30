import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import { RecoveryService } from '@/routes/recovery/recovery.service';
import { AddRecoveryModuleDtoValidationPipe } from '@/routes/recovery/pipes/add-recovery-module.validation.pipe';

@ApiTags('recovery')
@Controller({
  version: '1',
})
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @HttpCode(200)
  @Post('chains/:chainId/safes/:safeAddress/recovery')
  async addRecoveryModule(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(AddRecoveryModuleDtoValidationPipe)
    addRecoveryModuleDto: AddRecoveryModuleDto,
  ): Promise<void> {
    return this.recoveryService.addRecoveryModule({
      chainId,
      safeAddress,
      addRecoveryModuleDto,
    });
  }
}
