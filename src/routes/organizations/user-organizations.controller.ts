import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
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
import { UserOrganizationsDto } from '@/routes/organizations/entities/user-organizations.dto.entity';
import { Invitation } from '@/routes/organizations/entities/invitation.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { InviteUsersDto } from '@/routes/organizations/entities/invite-users.dto.entity';
import type { UpdateRoleDto } from '@/routes/organizations/entities/update-role.dto.entity';
import type { User } from '@/domain/users/entities/user.entity';

@ApiTags('organizations')
@Controller({ path: 'organizations', version: '1' })
export class UserOrganizationsController {
  constructor(
    @Inject(UserOrganizationsService)
    private readonly userOrgService: UserOrganizationsService,
  ) {}

  @ApiOkResponse({
    description: 'Users invited',
    type: Invitation,
    isArray: true,
  })
  @ApiConflictResponse({ description: 'Too many invites' })
  @ApiForbiddenResponse({ description: 'User not authorized' })
  @ApiUnauthorizedResponse({
    description:
      'User not admin OR signer address not provided OR member is not active',
  })
  @Post('/:orgId/members/invite')
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

  @ApiOkResponse({ description: 'Invite accepted' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer, organization or membership not found',
  })
  @ApiConflictResponse({ description: 'User invite not pending' })
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

  @ApiOkResponse({ description: 'Invite declined' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer, organization or membership not found',
  })
  @ApiConflictResponse({ description: 'User invite not pending' })
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

  @ApiOkResponse({
    description: 'Organization and members list',
    type: UserOrganizationsDto,
  })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer or organization not found',
  })
  @Get('/:orgId/members')
  @UseGuards(AuthGuard)
  public async getUsers(
    @Auth() authPayload: AuthPayload,
    @Param('orgId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    orgId: Organization['id'],
  ): Promise<UserOrganizationsDto> {
    return await this.userOrgService.get({
      authPayload,
      orgId,
    });
  }

  @ApiOkResponse({ description: 'Role updated' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description:
      'Signer, organization or signer/user-to-update membership not found',
  })
  @ApiUnauthorizedResponse({ description: 'Signer not active or admin' })
  @ApiConflictResponse({ description: 'Cannot remove last admin' })
  @Patch('/:orgId/members/:userId/role')
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

  @ApiOkResponse({ description: 'Membership deleted' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer or organization not found',
  })
  @ApiUnauthorizedResponse({ description: 'Signer not active or admin' })
  @ApiConflictResponse({ description: 'Cannot remove last admin' })
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
