import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SpacesService } from '@/routes/spaces/spaces.service';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { SpaceStatus } from '@/domain/spaces/entities/space.entity';
import {
  CreateSpaceDto,
  CreateSpaceResponse,
  CreateSpaceSchema,
} from '@/routes/spaces/entities/create-space.dto.entity';
import { GetSpaceResponse } from '@/routes/spaces/entities/get-space.dto.entity';
import {
  UpdateSpaceDto,
  UpdateSpaceResponse,
  UpdateSpaceSchema,
} from '@/routes/spaces/entities/update-space.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { SpacesCreationRateLimitGuard } from '@/routes/spaces/guards/spaces-creation-rate-limit.guard';

@ApiTags('spaces')
@UseGuards(AuthGuard)
@Controller({ path: 'spaces', version: '1' })
export class SpacesController {
  public constructor(private readonly spacesService: SpacesService) {}

  @Post()
  @UseGuards(SpacesCreationRateLimitGuard)
  @ApiOkResponse({
    description: 'Space created',
    type: CreateSpaceResponse,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async create(
    @Body(new ValidationPipe(CreateSpaceSchema))
    body: CreateSpaceDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<CreateSpaceResponse> {
    return await this.spacesService.create({
      authPayload,
      name: body.name,
      status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
    });
  }

  @Post('/create-with-user')
  @UseGuards(SpacesCreationRateLimitGuard)
  @ApiOkResponse({
    description: 'Space created',
    type: CreateSpaceResponse,
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async createWithUser(
    @Body(new ValidationPipe(CreateSpaceSchema))
    body: CreateSpaceDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<CreateSpaceResponse> {
    return await this.spacesService.createWithUser({
      authPayload,
      name: body.name,
      status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
      userStatus: getEnumKey(UserStatus, UserStatus.ACTIVE),
    });
  }

  @Get()
  @ApiOkResponse({
    description: 'Spaces found',
    type: GetSpaceResponse,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async get(
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<GetSpaceResponse>> {
    return await this.spacesService.getActiveOrInvitedSpaces(authPayload);
  }

  @Get('/:id')
  @ApiOkResponse({
    description: 'Space found',
    type: GetSpaceResponse,
  })
  @ApiNotFoundResponse({
    description: 'Space not found. OR User not found.',
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async getOne(
    @Param('id', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetSpaceResponse> {
    return await this.spacesService.getActiveOrInvitedSpace(id, authPayload);
  }

  @Patch('/:id')
  @UseGuards(SpacesCreationRateLimitGuard)
  @ApiOkResponse({
    description: 'Space updated',
    type: UpdateSpaceResponse,
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({
    description: 'Signer address not provided OR User is unauthorized',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  public async update(
    @Body(new ValidationPipe(UpdateSpaceSchema))
    payload: UpdateSpaceDto,
    @Param('id', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<UpdateSpaceResponse> {
    return await this.spacesService.update({
      id,
      authPayload,
      updatePayload: payload,
    });
  }

  @Delete('/:id')
  @ApiResponse({
    description: 'Spaces deleted',
    status: HttpStatus.NO_CONTENT,
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({
    description: 'Signer address not provided OR User is unauthorized',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(
    @Param('id', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.spacesService.delete({ id, authPayload });
  }
}
