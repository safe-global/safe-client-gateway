import { CreateCounterfactualSafeDtoSchema } from '@/modules/accounts/domain/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { CounterfactualSafesService } from '@/modules/accounts/routes/counterfactual-safes/counterfactual-safes.service';
import { CounterfactualSafe } from '@/modules/accounts/routes/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/modules/accounts/routes/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Address } from 'viem';

@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
export class CounterfactualSafesController {
  constructor(private readonly service: CounterfactualSafesService) {}

  @ApiOkResponse({ type: CounterfactualSafe })
  @Get(':address/counterfactual-safes/:chainId/:predictedAddress')
  async getCounterfactualSafe(
    @Param('address', new ValidationPipe(AddressSchema)) address: Address,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('predictedAddress', new ValidationPipe(AddressSchema))
    predictedAddress: Address,
  ): Promise<CounterfactualSafe> {
    return this.service.getCounterfactualSafe({
      address,
      chainId,
      predictedAddress,
    });
  }

  @ApiOkResponse({ type: CounterfactualSafe, isArray: true })
  @Get(':address/counterfactual-safes')
  async getCounterfactualSafes(
    @Param('address', new ValidationPipe(AddressSchema)) address: Address,
  ): Promise<Array<CounterfactualSafe>> {
    return this.service.getCounterfactualSafes(address);
  }

  @ApiOkResponse({ type: CounterfactualSafe })
  @Put(':address/counterfactual-safes')
  @UseGuards(AuthGuard)
  async createCounterfactualSafe(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: Address,
    @Body(new ValidationPipe(CreateCounterfactualSafeDtoSchema))
    createCounterfactualSafeDto: CreateCounterfactualSafeDto,
  ): Promise<CounterfactualSafe> {
    return this.service.createCounterfactualSafe({
      authPayload,
      address,
      createCounterfactualSafeDto,
    });
  }

  @Delete(':address/counterfactual-safes/:chainId/:predictedAddress')
  @UseGuards(AuthGuard)
  async deleteCounterfactualSafe(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: Address,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('predictedAddress', new ValidationPipe(AddressSchema))
    predictedAddress: Address,
  ): Promise<void> {
    return this.service.deleteCounterfactualSafe({
      authPayload,
      address,
      chainId,
      predictedAddress,
    });
  }

  @Delete(':address/counterfactual-safes')
  @UseGuards(AuthGuard)
  async deleteCounterfactualSafes(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: Address,
  ): Promise<void> {
    return this.service.deleteCounterfactualSafes({ authPayload, address });
  }
}
