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
import { OrganizationsService } from '@/routes/organizations/organizations.service';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import {
  CreateOrganizationDto,
  CreateOrganizationResponse,
  CreateOrganizationSchema,
} from '@/routes/organizations/entities/create-organization.dto.entity';
import { GetOrganizationResponse } from '@/routes/organizations/entities/get-organization.dto.entity';
import {
  UpdateOrganizationDto,
  UpdateOrganizationResponse,
  UpdateOrganizationSchema,
} from '@/routes/organizations/entities/update-organization.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import { UserStatus } from '@/domain/users/entities/user.entity';

@ApiTags('organizations')
@UseGuards(AuthGuard)
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  public constructor(
    private readonly organizationsService: OrganizationsService,
  ) {
    //
  }

  @Post()
  @ApiOkResponse({
    description: 'Organization created',
    type: CreateOrganizationResponse,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async create(
    @Body(new ValidationPipe(CreateOrganizationSchema))
    body: CreateOrganizationDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<CreateOrganizationResponse> {
    return await this.organizationsService.create({
      authPayload,
      name: body.name,
      status: getEnumKey(OrganizationStatus, OrganizationStatus.ACTIVE),
    });
  }

  @Post('/create-with-user')
  @ApiOkResponse({
    description: 'Organization created',
    type: CreateOrganizationResponse,
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async createWithUser(
    @Body(new ValidationPipe(CreateOrganizationSchema))
    body: CreateOrganizationDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<CreateOrganizationResponse> {
    return await this.organizationsService.createWithUser({
      authPayload,
      name: body.name,
      status: getEnumKey(OrganizationStatus, OrganizationStatus.ACTIVE),
      userStatus: getEnumKey(UserStatus, UserStatus.ACTIVE),
    });
  }

  @Get()
  @ApiOkResponse({
    description: 'Organizations found',
    type: GetOrganizationResponse,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async get(
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<GetOrganizationResponse>> {
    return await this.organizationsService.getActiveOrInvitedOrganizations(
      authPayload,
    );
  }

  @Get('/:id')
  @ApiOkResponse({
    description: 'Organization found',
    type: GetOrganizationResponse,
  })
  @ApiNotFoundResponse({
    description: 'Organization not found. OR User not found.',
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async getOne(
    @Param('id', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetOrganizationResponse> {
    return await this.organizationsService.getActiveOrganization(
      id,
      authPayload,
    );
  }

  @Patch('/:id')
  @ApiOkResponse({
    description: 'Organization updated',
    type: UpdateOrganizationResponse,
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({
    description: 'Signer address not provided OR User is unauthorized',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  public async update(
    @Body(new ValidationPipe(UpdateOrganizationSchema))
    payload: UpdateOrganizationDto,
    @Param('id', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<UpdateOrganizationResponse> {
    return await this.organizationsService.update({
      id,
      authPayload,
      updatePayload: payload,
    });
  }

  @Delete('/:id')
  @ApiResponse({
    description: 'Organization deleted',
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
    return await this.organizationsService.delete({ id, authPayload });
  }
}
