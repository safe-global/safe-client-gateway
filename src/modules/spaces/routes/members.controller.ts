import {
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import { MembersService } from '@/modules/spaces/routes/members.service';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  InviteUsersDto,
  InviteUsersDtoSchema,
} from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import { UpdateRoleDtoSchema } from '@/modules/spaces/routes/entities/update-role.dto.entity';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { MembersDto } from '@/modules/spaces/routes/entities/members.dto.entity';
import { Invitation } from '@/modules/spaces/routes/entities/invitation.entity';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { UpdateRoleDto } from '@/modules/spaces/routes/entities/update-role.dto.entity';
import {
  AcceptInviteDto,
  AcceptInviteDtoSchema,
} from '@/modules/spaces/routes/entities/accept-invite.dto.entity';
import {
  UpdateMemberAliasDto,
  UpdateMemberAliasDtoSchema,
} from '@/modules/spaces/routes/entities/update-member-name.dto.entity';

@ApiTags('spaces')
@Controller({ path: 'spaces', version: '1' })
export class MembersController {
  constructor(
    @Inject(MembersService)
    private readonly membersService: MembersService,
  ) {}

  @ApiOperation({
    summary: 'Invite users to space',
    description:
      'Invites one or more users to join a space. Only space admins can send invitations.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to invite users to',
    example: 1,
  })
  @ApiBody({
    type: InviteUsersDto,
    description: 'List of wallet addresses to invite to the space',
  })
  @ApiOkResponse({
    description: 'Users invited successfully',
    type: Invitation,
    isArray: true,
  })
  @ApiConflictResponse({
    description: 'Too many invites or some users already invited',
  })
  @ApiForbiddenResponse({
    description: 'User not authorized - must be a space admin to invite users',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user not admin or member not active',
  })
  @Post('/:spaceId/members/invite')
  @UseGuards(AuthGuard)
  public async inviteUser(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Body(new ValidationPipe(InviteUsersDtoSchema))
    inviteUsersDto: InviteUsersDto,
  ): Promise<Array<Invitation>> {
    return await this.membersService.inviteUser({
      authPayload,
      spaceId,
      inviteUsersDto,
    });
  }

  @ApiOperation({
    summary: 'Accept space invitation',
    description:
      'Accepts an invitation to join a space. The user must have a pending invitation to the space.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to accept invitation for',
    example: 1,
  })
  @ApiBody({
    type: AcceptInviteDto,
    description:
      'Invitation acceptance data including any required confirmation',
  })
  @ApiOkResponse({
    description:
      'Invitation accepted successfully - user is now a member of the space',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not authorized to accept this invitation',
  })
  @ApiNotFoundResponse({
    description: 'User, space, or membership invitation not found',
  })
  @ApiConflictResponse({
    description: 'User invitation is not in pending state or already processed',
  })
  @Post('/:spaceId/members/accept')
  @UseGuards(AuthGuard)
  public async acceptInvite(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Body(new ValidationPipe(AcceptInviteDtoSchema))
    acceptInviteDto: AcceptInviteDto,
  ): Promise<void> {
    return await this.membersService.acceptInvite({
      authPayload,
      spaceId,
      acceptInviteDto,
    });
  }

  @ApiOperation({
    summary: 'Decline space invitation',
    description:
      'Declines an invitation to join a space. The user must have a pending invitation to the space.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to decline invitation for',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Invitation declined successfully',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not authorized to decline this invitation',
  })
  @ApiNotFoundResponse({
    description: 'User, space, or membership invitation not found',
  })
  @ApiConflictResponse({
    description: 'User invitation is not in pending state or already processed',
  })
  @Post('/:spaceId/members/decline')
  @UseGuards(AuthGuard)
  public async declineInvite(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
  ): Promise<void> {
    return await this.membersService.declineInvite({
      authPayload,
      spaceId,
    });
  }

  @ApiOperation({
    summary: 'Get space members',
    description:
      'Retrieves all members of a space including their roles, status, and membership information.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to get members for',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Space members retrieved successfully',
    type: MembersDto,
  })
  @ApiForbiddenResponse({
    description:
      "Access forbidden - user is not authorized to view this space's members",
  })
  @ApiNotFoundResponse({
    description: 'User or space not found',
  })
  @Get('/:spaceId/members')
  @UseGuards(AuthGuard)
  public async getUsers(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
  ): Promise<MembersDto> {
    return await this.membersService.get({
      authPayload,
      spaceId,
    });
  }

  @ApiOperation({
    summary: 'Update member role',
    description:
      'Updates the role of a space member. Only space admins can change member roles. Cannot remove the last admin from a space.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID containing the member',
    example: 1,
  })
  @ApiParam({
    name: 'userId',
    type: 'number',
    description: 'User ID of the member to update',
    example: 123,
  })
  @ApiBody({
    type: UpdateRoleDto,
    description: 'New role information for the member',
  })
  @ApiOkResponse({
    description: 'Member role updated successfully',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not authorized to update member roles',
  })
  @ApiNotFoundResponse({
    description: 'User, space, or member not found',
  })
  @ApiUnauthorizedResponse({
    description: 'User is not active or not an admin of this space',
  })
  @ApiConflictResponse({
    description: 'Cannot remove the last admin from the space',
  })
  @Patch('/:spaceId/members/:userId/role')
  @UseGuards(AuthGuard)
  public async updateRole(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Param('userId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    userId: number,
    @Body(new ValidationPipe(UpdateRoleDtoSchema))
    updateRoleDto: UpdateRoleDto,
  ): Promise<void> {
    return await this.membersService.updateRole({
      authPayload,
      spaceId,
      userId,
      updateRoleDto,
    });
  }

  @ApiOperation({
    summary: 'Update member alias',
    description:
      'Update the alias of the authenticated member in a space. Users can only update their own alias.',
  })
  @ApiOkResponse({ description: 'Alias updated' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer, space or member not found',
  })
  @Patch('/:spaceId/members/alias')
  @UseGuards(AuthGuard)
  public async updateAlias(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Body(new ValidationPipe(UpdateMemberAliasDtoSchema))
    updateMemberAliasDto: UpdateMemberAliasDto,
  ): Promise<void> {
    await this.membersService.updateAlias({
      authPayload,
      spaceId,
      updateMemberAliasDto,
    });
  }

  @ApiOperation({
    summary: 'Remove member from space',
    description:
      'Removes a member from a space. Only space admins can remove other members. Cannot remove the last admin from a space.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to remove member from',
    example: 1,
  })
  @ApiParam({
    name: 'userId',
    type: 'number',
    description: 'User ID of the member to remove',
    example: 123,
  })
  @ApiOkResponse({
    description: 'Member removed from space successfully',
  })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not authorized to remove members',
  })
  @ApiNotFoundResponse({
    description: 'User, space, or member not found',
  })
  @ApiUnauthorizedResponse({
    description: 'User is not active or not an admin of this space',
  })
  @ApiConflictResponse({
    description: 'Cannot remove the last admin from the space',
  })
  @Delete('/:spaceId/members/:userId')
  @UseGuards(AuthGuard)
  public async removeUser(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Param('userId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    userId: number,
  ): Promise<void> {
    return await this.membersService.removeUser({
      authPayload,
      spaceId,
      userId,
    });
  }

  @ApiOperation({
    summary: 'Leave a space',
    description: 'Remove own membership from a space.',
  })
  @ApiOkResponse({ description: 'Membership deleted' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer or space not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Signer address not provided',
  })
  @ApiConflictResponse({ description: 'Cannot remove last admin' })
  @Delete('/:spaceId/members')
  @UseGuards(AuthGuard)
  public async selfRemove(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
  ): Promise<void> {
    return await this.membersService.selfRemove({
      authPayload,
      spaceId,
    });
  }
}
