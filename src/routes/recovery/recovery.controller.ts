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
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
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
  @UseGuards(AuthGuard)
  async addRecoveryModule(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Body(new ValidationPipe(AddRecoveryModuleDtoSchema))
    addRecoveryModuleDto: AddRecoveryModuleDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return this.recoveryService.addRecoveryModule({
      chainId,
      safeAddress,
      addRecoveryModuleDto,
      authPayload,
    });
  }

  @HttpCode(204)
  @Delete('/:moduleAddress')
  @UseGuards(AuthGuard)
  async deleteRecoveryModule(
    @Param('chainId') chainId: string,
    @Param('moduleAddress', new ValidationPipe(AddressSchema))
    moduleAddress: `0x${string}`,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return this.recoveryService.deleteRecoveryModule({
      chainId,
      moduleAddress,
      safeAddress,
      authPayload,
    });
  }
}
