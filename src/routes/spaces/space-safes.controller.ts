import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import {
  CreateSpaceSafesDto,
  CreateSpaceSafesSchema,
} from '@/routes/spaces/entities/create-space-safe.dto.entity';
import {
  DeleteSpaceSafesDto,
  DeleteSpaceSafesSchema,
} from '@/routes/spaces/entities/delete-space-safe.dto.entity';
import { GetSpaceSafeResponse } from '@/routes/spaces/entities/get-space-safe.dto.entity';
import { SpaceSafesService } from '@/routes/spaces/space-safes.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/safes',
  version: '1',
})
@UseGuards(AuthGuard)
export class SpaceSafesController {
  public constructor(
    @Inject(SpaceSafesService)
    private readonly spaceSafesService: SpaceSafesService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Safes created successfully' })
  @ApiBody({ type: CreateSpaceSafesDto })
  @ApiUnauthorizedResponse({
    description: 'User unauthorize OR signer address not provided',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  public async create(
    @Body(new ValidationPipe(CreateSpaceSafesSchema))
    body: CreateSpaceSafesDto,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.spaceSafesService.create({
      spaceId,
      authPayload,
      payload: body.safes,
    });
  }

  @Get()
  @ApiOkResponse({
    description: 'Safes fetched successfully',
    type: GetSpaceSafeResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'User unauthorized OR signer address not provided',
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  public async get(
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetSpaceSafeResponse> {
    return await this.spaceSafesService.get(spaceId, authPayload);
  }

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Safes deleted successfully' })
  @ApiUnauthorizedResponse({
    description: 'User unauthorized OR signer address not provided',
  })
  @ApiNotFoundResponse({
    description: 'Space has no Safes OR user not found.',
  })
  public async delete(
    @Body(new ValidationPipe(DeleteSpaceSafesSchema))
    body: DeleteSpaceSafesDto,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.spaceSafesService.delete({
      authPayload,
      payload: body.safes,
      spaceId,
    });
  }
}
