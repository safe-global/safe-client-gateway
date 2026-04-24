// SPDX-License-Identifier: FSL-1.1-MIT
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
import type { Address } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import type { AddRecoveryModuleDto } from '@/modules/recovery/routes/entities/add-recovery-module.dto.entity';
import { AddRecoveryModuleDtoSchema } from '@/modules/recovery/routes/entities/schemas/add-recovery-module.dto.schema';
import { RecoveryService } from '@/modules/recovery/routes/recovery.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
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
  addRecoveryModule(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
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
  deleteRecoveryModule(
    @Param('chainId') chainId: string,
    @Param('moduleAddress', new ValidationPipe(AddressSchema))
    moduleAddress: Address,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
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
