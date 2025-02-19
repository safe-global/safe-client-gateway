import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import {
  CreateOrganizationSafeDto,
  CreateOrganizationSafesSchema,
} from '@/routes/organizations/entities/create-organization-safe.dto.entity';
import {
  DeleteOrganizationSafeDto,
  DeleteOrganizationSafesSchema,
} from '@/routes/organizations/entities/delete-organization-safe.dto.entity';
import { GetOrganizationSafeResponse } from '@/routes/organizations/entities/get-organization-safe.dto.entity';
import { OrganizationSafesService } from '@/routes/organizations/organization-safes.service';
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

@ApiTags('organizations-safe')
@Controller({
  path: 'organizations/:organizationId/safes',
  version: '1',
})
@UseGuards(AuthGuard)
export class OrganizationSafesController {
  public constructor(
    @Inject(OrganizationSafesService)
    private readonly organizationSafesService: OrganizationSafesService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Safes created successfully' })
  @ApiBody({ type: CreateOrganizationSafeDto, isArray: true })
  @ApiUnauthorizedResponse({
    description: 'User unauthorize OR signer address not provided',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  public async create(
    @Body(new ValidationPipe(CreateOrganizationSafesSchema))
    body: Array<CreateOrganizationSafeDto>,
    @Param(
      'organizationId',
      ParseIntPipe,
      new ValidationPipe(RowSchema.shape.id),
    )
    organizationId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.organizationSafesService.create({
      organizationId,
      authPayload,
      payload: body,
    });
  }

  @Get()
  @ApiOkResponse({
    description: 'Safes fetched successfully',
    type: GetOrganizationSafeResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'User unauthorized OR signer address not provided',
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  public async get(
    @Param(
      'organizationId',
      ParseIntPipe,
      new ValidationPipe(RowSchema.shape.id),
    )
    organizationId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetOrganizationSafeResponse> {
    return await this.organizationSafesService.get(organizationId, authPayload);
  }

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Safes deleted successfully' })
  @ApiUnauthorizedResponse({
    description: 'User unauthorized OR signer address not provided',
  })
  @ApiNotFoundResponse({
    description: 'Organization has no Safes OR user not found.',
  })
  public async delete(
    @Body(new ValidationPipe(DeleteOrganizationSafesSchema))
    body: Array<DeleteOrganizationSafeDto>,
    @Param(
      'organizationId',
      ParseIntPipe,
      new ValidationPipe(RowSchema.shape.id),
    )
    organizationId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.organizationSafesService.delete({
      authPayload,
      payload: body,
      organizationId,
    });
  }
}
