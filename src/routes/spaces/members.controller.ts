import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
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
import { MembersService } from '@/routes/spaces/members.service';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  InviteUsersDto,
  InviteUsersDtoSchema,
} from '@/routes/spaces/entities/invite-users.dto.entity';
import { UpdateRoleDtoSchema } from '@/routes/spaces/entities/update-role.dto.entity';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { MembersDto } from '@/routes/spaces/entities/members.dto.entity';
import { Invitation } from '@/routes/spaces/entities/invitation.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { UpdateRoleDto } from '@/routes/spaces/entities/update-role.dto.entity';
import {
  AcceptInviteDto,
  AcceptInviteDtoSchema,
} from '@/routes/spaces/entities/accept-invite.dto.entity';

@ApiTags('spaces')
@Controller({ path: 'spaces', version: '1' })
export class MembersController {
  constructor(
    @Inject(MembersService)
    private readonly membersService: MembersService,
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

  @ApiOkResponse({ description: 'Invite accepted' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer, space or membership not found',
  })
  @ApiConflictResponse({ description: 'User invite not pending' })
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

  @ApiOkResponse({ description: 'Invite declined' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer, space or membership not found',
  })
  @ApiConflictResponse({ description: 'User invite not pending' })
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

  @ApiOkResponse({
    description: 'Space and members list',
    type: MembersDto,
  })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer or space not found',
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

  @ApiOkResponse({ description: 'Role updated' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer, space or signer/user-to-update membership not found',
  })
  @ApiUnauthorizedResponse({ description: 'Signer not active or admin' })
  @ApiConflictResponse({ description: 'Cannot remove last admin' })
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

  @ApiOkResponse({ description: 'Membership deleted' })
  @ApiForbiddenResponse({ description: 'Signer not authorized' })
  @ApiNotFoundResponse({
    description: 'Signer or space not found',
  })
  @ApiUnauthorizedResponse({ description: 'Signer not active or admin' })
  @ApiConflictResponse({ description: 'Cannot remove last admin' })
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
