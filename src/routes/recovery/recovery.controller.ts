import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import { RecoveryService } from '@/routes/recovery/recovery.service';
import { AddRecoveryModuleDtoValidationPipe } from '@/routes/recovery/pipes/add-recovery-module.validation.pipe';
import { DeleteRecoveryModuleDtoValidationPipe } from '@/routes/recovery/pipes/delete-recovery-module.validation.pipe';
import { DeleteRecoveryModuleDto } from '@/routes/recovery/entities/delete-recovery-module.dto.entity';

@ApiTags('recovery')
@Controller({
  version: '1',
  path: 'chains/:chainId/safes/:safeAddress/recovery',
})
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @HttpCode(200)
  @Post()
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

  @HttpCode(200)
  @Delete()
  async deleteRecoveryModule(
    @Param('chainId') chainId: string,
    @Body(DeleteRecoveryModuleDtoValidationPipe)
    deleteRecoveryModuleDto: DeleteRecoveryModuleDto,
  ): Promise<void> {
    return this.recoveryService.deleteRecoveryModule({
      chainId,
      deleteRecoveryModuleDto,
    });
  }
}
