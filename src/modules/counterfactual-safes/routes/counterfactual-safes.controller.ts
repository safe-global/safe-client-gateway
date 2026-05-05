// SPDX-License-Identifier: FSL-1.1-MIT

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { CounterfactualSafesService } from '@/modules/counterfactual-safes/routes/counterfactual-safes.service';
import { CounterfactualSafesSchema } from '@/modules/counterfactual-safes/routes/entities/counterfactual-safe.dto.entity';
import { CreateCounterfactualSafesDto } from '@/modules/counterfactual-safes/routes/entities/create-counterfactual-safe.dto.entity';
import {
  type DeleteCounterfactualSafesDto,
  DeleteCounterfactualSafesSchema,
} from '@/modules/counterfactual-safes/routes/entities/delete-counterfactual-safe.dto.entity';
import { GetCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/entities/get-counterfactual-safe.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('counterfactual-safes')
@Controller({
  path: 'users/counterfactual-safes',
  version: '1',
})
@UseGuards(AuthGuard)
export class CounterfactualSafesController {
  public constructor(
    @Inject(CounterfactualSafesService)
    private readonly counterfactualSafesService: CounterfactualSafesService,
  ) {}

  @ApiOperation({
    summary: 'Save counterfactual Safe creation parameters',
    description:
      'Stores the CREATE2 deployment parameters for one or more counterfactual (undeployed) Safes. These parameters are needed to deploy the Safe later.',
  })
  @ApiBody({
    type: CreateCounterfactualSafesDto,
    description: 'Counterfactual Safe creation parameters',
  })
  @ApiCreatedResponse({
    description: 'Counterfactual Safes saved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @Post()
  public async create(
    @Body(new ValidationPipe(CounterfactualSafesSchema))
    body: CreateCounterfactualSafesDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.counterfactualSafesService.create({
      authPayload,
      payload: body.safes,
    });
  }

  @ApiOperation({
    summary: 'Get counterfactual Safes',
    description:
      'Retrieves all counterfactual (undeployed) Safes for the authenticated user, grouped by chain ID.',
  })
  @ApiOkResponse({
    description: 'Counterfactual Safes retrieved successfully',
    type: GetCounterfactualSafesResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @Get()
  public async get(
    @Auth() authPayload: AuthPayload,
  ): Promise<GetCounterfactualSafesResponse> {
    return await this.counterfactualSafesService.get(authPayload);
  }

  @ApiOperation({
    summary: 'Delete counterfactual Safes',
    description:
      'Removes counterfactual Safe records for the authenticated user, typically after successful deployment.',
  })
  @ApiNoContentResponse({
    description: 'Counterfactual Safes deleted successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiNotFoundResponse({
    description: 'Counterfactual Safe not found',
  })
  @Delete()
  @HttpCode(204)
  public async delete(
    @Body(new ValidationPipe(DeleteCounterfactualSafesSchema))
    body: DeleteCounterfactualSafesDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.counterfactualSafesService.delete({
      authPayload,
      payload: body.safes,
    });
  }
}
