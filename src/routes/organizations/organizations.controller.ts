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
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from '@/routes/organizations/organizations.service';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import { CreateOrganizationResponse } from '@/routes/organizations/entities/create-organizations.dto.entity';
import {
  CreateOrganizationDto,
  CreateOrganizationSchema,
} from '@/routes/organizations/entities/create-organization.dto.entity';
import { GetOrganizationResponse } from '@/routes/organizations/entities/get-organization.dto.entity';
import {
  UpdateOrganizationDto,
  UpdateOrganizationResponse,
} from '@/routes/organizations/entities/update-organization.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
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
    description: 'Organizations created',
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
      status: OrganizationStatus.ACTIVE,
    });
  }

  @Get()
  @ApiOkResponse({
    description: 'Organizations found',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async get(
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<GetOrganizationResponse>> {
    return await this.organizationsService.get(authPayload);
  }

  @Get('/:id')
  @ApiOkResponse({
    description: 'Organization found',
  })
  @ApiNotFoundResponse({
    description: 'Organization not found. OR User not found.',
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  public async getOne(
    @Param('id', new ValidationPipe(RowSchema.shape.id)) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetOrganizationResponse> {
    return await this.organizationsService.getOne(id, authPayload);
  }

  @Patch('/:id')
  @ApiOkResponse({
    description: 'Organization updated',
  })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiUnauthorizedResponse({
    description: 'Signer address not provided OR User is unauthorized',
  })
  public async update(
    @Body() payload: UpdateOrganizationDto,
    @Param('id', new ValidationPipe(RowSchema.shape.id)) id: number,
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
  public async delete(
    @Param('id', new ValidationPipe(RowSchema.shape.id)) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.organizationsService.delete({ id, authPayload });
  }
}
