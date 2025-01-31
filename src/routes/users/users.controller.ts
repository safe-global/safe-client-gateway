import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { UsersService } from '@/routes/users/users.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { UserWithWallets } from '@/routes/users/entities/user-with-wallets.entity';
import { CreatedUserWithWallet } from '@/routes/users/entities/created-user-with-wallet.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @ApiOkResponse({ type: UserWithWallets })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Get()
  @UseGuards(AuthGuard)
  public async getUseWithWallets(
    @Auth() authPayload: AuthPayload,
  ): Promise<UserWithWallets> {
    return await this.usersService.getUserWithWallets(authPayload);
  }

  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Could not delete user' })
  @Delete()
  @UseGuards(AuthGuard)
  public async deleteUser(@Auth() authPayload: AuthPayload): Promise<void> {
    return await this.usersService.deleteUser(authPayload);
  }

  @ApiOkResponse({ type: CreatedUserWithWallet })
  @ApiConflictResponse({
    description: 'A wallet with the same address already exists',
  })
  @Post('/wallet')
  @UseGuards(AuthGuard)
  public async createUserWithWallet(
    @Auth() authPayload: AuthPayload,
  ): Promise<CreatedUserWithWallet> {
    return await this.usersService.createUserWithWallet(authPayload);
  }

  @ApiConflictResponse({
    description:
      'Cannot remove the current wallet OR User could not be remove from wallet',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiOkResponse({ description: 'Wallet removed from user and deleted' })
  @Delete('/wallet/:walletAddress')
  @UseGuards(AuthGuard)
  public async deleteWalletFromUser(
    @Param('walletAddress', new ValidationPipe(AddressSchema))
    walletAddress: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.usersService.deleteWalletFromUser({
      authPayload,
      walletAddress,
    });
  }
}
