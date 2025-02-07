import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from '@/routes/organizations/organizations.service';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { InviteUserDtoSchema } from '@/routes/organizations/entities/invite-user.dto.entity';
import { UpdateRoleDtoSchema } from '@/routes/organizations/entities/update-role.dto.entity';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { InviteUserDto } from '@/routes/organizations/entities/invite-user.dto.entity';
import type { UpdateRoleDto } from '@/routes/organizations/entities/update-role.dto.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';
import type { Invite } from '@/routes/organizations/entities/invite.entity';
import type { Members } from '@/routes/organizations/entities/members.entity';

// TODO: Add Swagger definitions

@ApiTags('organizations')
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post('/:orgId/members')
  @UseGuards(AuthGuard)
  public async inviteUser(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
    @Body(new ValidationPipe(InviteUserDtoSchema))
    inviteUserDto: InviteUserDto,
  ): Promise<Invite> {
    return await this.organizationsService.inviteUser({
      authPayload,
      orgId,
      inviteUserDto,
    });
  }

  @Post('/:orgId/members/:userOrgId/accept')
  @UseGuards(AuthGuard)
  public async acceptInvite(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
    @Param('userOrgId', new ValidationPipe(RowSchema.shape.id))
    userOrgId: UserOrganization['id'],
  ): Promise<void> {
    return await this.organizationsService.acceptInvite({
      authPayload,
      orgId,
      userOrgId,
    });
  }

  @Post('/:orgId/members/:userOrgId/decline')
  @UseGuards(AuthGuard)
  public async declineInvite(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
    @Param('userOrgId', new ValidationPipe(RowSchema.shape.id))
    userOrgId: UserOrganization['id'],
  ): Promise<void> {
    return await this.organizationsService.declineInvite({
      authPayload,
      orgId,
      userOrgId,
    });
  }

  @Get('/:orgId/members')
  @UseGuards(AuthGuard)
  public async getUsers(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
  ): Promise<Members> {
    return await this.organizationsService.get({
      authPayload,
      orgId,
    });
  }

  @Post('/:orgId/members/:userOrgId/role')
  @UseGuards(AuthGuard)
  public async updateRole(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
    @Param('userOrgId', new ValidationPipe(RowSchema.shape.id))
    userOrgId: UserOrganization['id'],
    @Body(new ValidationPipe(UpdateRoleDtoSchema))
    updateRoleDto: UpdateRoleDto,
  ): Promise<void> {
    return await this.organizationsService.updateRole({
      authPayload,
      orgId,
      userOrgId,
      updateRoleDto,
    });
  }

  @Delete('/:orgId/members/:userOrgId')
  @UseGuards(AuthGuard)
  public async removeUser(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
    @Param('userOrgId', new ValidationPipe(RowSchema.shape.id))
    userOrgId: UserOrganization['id'],
  ): Promise<void> {
    return await this.organizationsService.removeUser({
      authPayload,
      orgId,
      userOrgId,
    });
  }
}
