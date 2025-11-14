import {
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import {
  CreateSpaceDto,
  CreateSpaceResponse,
  CreateSpaceSchema,
} from '@/modules/spaces/routes/entities/create-space.dto.entity';
import { GetSpaceResponse } from '@/modules/spaces/routes/entities/get-space.dto.entity';
import {
  UpdateSpaceDto,
  UpdateSpaceResponse,
  UpdateSpaceSchema,
} from '@/modules/spaces/routes/entities/update-space.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

@ApiTags('spaces')
@UseGuards(AuthGuard)
@Controller({ path: 'spaces', version: '1' })
export class SpacesController {
  public constructor(private readonly spacesService: SpacesService) {}

  @ApiOperation({
    summary: 'Create space',
    description:
      'Creates a new space for the authenticated user. A space is a collaborative workspace where users can manage multiple Safes together.',
  })
  @ApiBody({
    type: CreateSpaceDto,
    description: 'Space creation data including the name of the space',
  })
  @ApiOkResponse({
    description: 'Space created successfully',
    type: CreateSpaceResponse,
  })
  @ApiNotFoundResponse({
    description:
      'User not found - the authenticated wallet is not associated with any user',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user lacks permission to create spaces',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Post()
  @UseGuards(SpacesCreationRateLimitGuard)
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

  @ApiOperation({
    summary: 'Create space with user',
    description:
      'Creates a new space and automatically creates a user account if one does not exist for the authenticated wallet.',
  })
  @ApiBody({
    type: CreateSpaceDto,
    description: 'Space creation data including the name of the space',
  })
  @ApiOkResponse({
    description: 'Space and user created successfully',
    type: CreateSpaceResponse,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user lacks permission to create spaces',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Post('/create-with-user')
  @UseGuards(SpacesCreationRateLimitGuard)
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

  @ApiOperation({
    summary: 'Get user spaces',
    description:
      'Retrieves all spaces that the authenticated user is a member of or has been invited to.',
  })
  @ApiOkResponse({
    description: 'User spaces retrieved successfully',
    type: GetSpaceResponse,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description:
      'User not found - the authenticated wallet is not associated with any user',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user lacks permission to view spaces',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Get()
  public async get(
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<GetSpaceResponse>> {
    return await this.spacesService.getActiveOrInvitedSpaces(authPayload);
  }

  @ApiOperation({
    summary: 'Get space by ID',
    description:
      'Retrieves detailed information about a specific space. The user must be a member of or invited to the space.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'Space ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Space information retrieved successfully',
    type: GetSpaceResponse,
  })
  @ApiNotFoundResponse({
    description: 'Space not found or user not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user is not a member of this space',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Get('/:id')
  public async getOne(
    @Param('id', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetSpaceResponse> {
    return await this.spacesService.getActiveOrInvitedSpace(id, authPayload);
  }

  @ApiOperation({
    summary: 'Update space',
    description:
      'Updates space information such as name. Only space admins can update space details.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'Space ID to update',
    example: 1,
  })
  @ApiBody({
    type: UpdateSpaceDto,
    description: 'Space update data including new name or other properties',
  })
  @ApiOkResponse({
    description: 'Space updated successfully',
    type: UpdateSpaceResponse,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user is not an admin of this space',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user unauthorized to update this space',
  })
  @ApiNotFoundResponse({
    description: 'User or space not found',
  })
  @Patch('/:id')
  @UseGuards(SpacesCreationRateLimitGuard)
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

  @ApiOperation({
    summary: 'Delete space',
    description:
      'Deletes a space and all its associated data. Only space admins can delete spaces.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'Space ID to delete',
    example: 1,
  })
  @ApiResponse({
    description: 'Space deleted successfully',
    status: HttpStatus.NO_CONTENT,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user is not an admin of this space',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user unauthorized to delete this space',
  })
  @ApiNotFoundResponse({
    description: 'User or space not found',
  })
  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(
    @Param('id', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.spacesService.delete({ id, authPayload });
  }
}
