import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserOrganizationsService } from '@/routes/organizations/user-organizations.service';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { InviteUsersDtoSchema } from '@/routes/organizations/entities/invite-users.dto.entity';
import { UpdateRoleDtoSchema } from '@/routes/organizations/entities/update-role.dto.entity';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { InviteUsersDto } from '@/routes/organizations/entities/invite-users.dto.entity';
import type { UpdateRoleDto } from '@/routes/organizations/entities/update-role.dto.entity';
import type { Invitation } from '@/routes/organizations/entities/invitation.entity';
import type { Members } from '@/routes/organizations/entities/members.entity';
import type { User } from '@/domain/users/entities/user.entity';

// TODO: Add Swagger definitions

@ApiTags('organizations')
@Controller({ path: 'organizations', version: '1' })
export class UserOrganizationsController {
  constructor(
    @Inject(UserOrganizationsService)
    private readonly userOrgService: UserOrganizationsService,
  ) {}

  @Post('/:orgId/members')
  @UseGuards(AuthGuard)
  public async inviteUser(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
    @Body(new ValidationPipe(InviteUsersDtoSchema))
    inviteUsersDto: InviteUsersDto,
  ): Promise<Array<Invitation>> {
    return await this.userOrgService.inviteUser({
      authPayload,
      orgId,
      inviteUsersDto,
    });
  }

  @Post('/:orgId/members/accept')
  @UseGuards(AuthGuard)
  public async acceptInvite(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
  ): Promise<void> {
    return await this.userOrgService.acceptInvite({
      authPayload,
      orgId,
    });
  }

  @Post('/:orgId/members/decline')
  @UseGuards(AuthGuard)
  public async declineInvite(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
  ): Promise<void> {
    return await this.userOrgService.declineInvite({
      authPayload,
      orgId,
    });
  }

  @Get('/:orgId/members')
  @UseGuards(AuthGuard)
  public async getUsers(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
  ): Promise<Members> {
    return await this.userOrgService.get({
      authPayload,
      orgId,
    });
  }

  @Post('/:orgId/members/:userId/role')
  @UseGuards(AuthGuard)
  public async updateRole(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
    @Param('userId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    userId: User['id'],
    @Body(new ValidationPipe(UpdateRoleDtoSchema))
    updateRoleDto: UpdateRoleDto,
  ): Promise<void> {
    return await this.userOrgService.updateRole({
      authPayload,
      orgId,
      userId,
      updateRoleDto,
    });
  }

  @Delete('/:orgId/members/:userId')
  @UseGuards(AuthGuard)
  public async removeUser(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
    @Param('userId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    userId: User['id'],
  ): Promise<void> {
    return await this.userOrgService.removeUser({
      authPayload,
      orgId,
      userId,
    });
  }
}
