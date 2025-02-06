import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateOrganizationResponse } from '@/routes/organizations/entities/create-organizations.dto.entity';
import { CreateOrganizationDto } from '@/routes/organizations/entities/create-organization.dto.entity';
import { GetOrganizationResponse } from '@/routes/organizations/entities/get-organization.dto.entity';
import {
  UpdateOrganizationDto,
  UpdateOrganizationResponse,
} from '@/routes/organizations/entities/update-organization.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { z } from 'zod';

@ApiTags('organizations')
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  public constructor(
    private readonly organizationsService: OrganizationsService,
  ) {
    //
  }

  @Post()
  @UseGuards(AuthGuard)
  public async create(
    @Body() body: CreateOrganizationDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<CreateOrganizationResponse> {
    return await this.organizationsService.create({
      authPayload,
      name: body.name,
      status: OrganizationStatus.ACTIVE,
    });
  }

  @Get()
  @UseGuards(AuthGuard)
  public async get(
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<GetOrganizationResponse>> {
    return await this.organizationsService.get(authPayload);
  }

  @Get('/:id')
  @UseGuards(AuthGuard)
  public async getOne(
    @Param('id', new ValidationPipe(z.number())) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetOrganizationResponse> {
    return await this.organizationsService.getOne(id, authPayload);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard)
  public async update(
    @Body() payload: UpdateOrganizationDto,
    @Param('id', new ValidationPipe(z.number())) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<UpdateOrganizationResponse> {
    return await this.organizationsService.update({
      id,
      authPayload,
      updatePayload: payload,
    });
  }

  @Delete('/:id')
  @UseGuards(AuthGuard)
  public async delete(
    @Param('id', ParseIntPipe) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.organizationsService.delete({ id, authPayload });
  }
}
