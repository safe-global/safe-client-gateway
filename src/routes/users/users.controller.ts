import {
  ApiConflictResponse,
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
import { WalletAddedToUser } from '@/routes/users/entities/wallet-added-to-user.entity';
import { SiweDtoSchema } from '@/routes/auth/entities/siwe.dto.entity';
import { SiweDto } from '@/routes/auth/entities/siwe.dto.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @ApiOkResponse({ type: UserWithWallets })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  @ApiNotFoundResponse({ description: 'User (wallet) not found' })
  @Get()
  @UseGuards(AuthGuard)
  public async getWithWallets(
    @Auth() authPayload: AuthPayload,
  ): Promise<UserWithWallets> {
    return await this.usersService.getWithWallets(authPayload);
  }

  @ApiOkResponse({ description: 'User deleted' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  @ApiNotFoundResponse({ description: 'User (wallet) not found' })
  @Delete()
  @UseGuards(AuthGuard)
  public async delete(@Auth() authPayload: AuthPayload): Promise<void> {
    return await this.usersService.delete(authPayload);
  }

  // @todo move wallet methods to Wallet controller
  @ApiOkResponse({ type: CreatedUserWithWallet })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  @ApiConflictResponse({ description: 'Wallet already exists' })
  @Post('/wallet')
  @UseGuards(AuthGuard)
  public async createWithWallet(
    @Auth() authPayload: AuthPayload,
  ): Promise<CreatedUserWithWallet> {
    return await this.usersService.createWithWallet(authPayload);
  }

  @ApiOkResponse({ type: WalletAddedToUser })
  @ApiUnauthorizedResponse({
    description: 'Signer address not provided OR invalid message/signature',
  })
  @ApiConflictResponse({ description: 'Wallet already exists' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Post('/wallet/add')
  @UseGuards(AuthGuard)
  public async addWalletToUser(
    @Auth() authPayload: AuthPayload,
    @Body(new ValidationPipe(SiweDtoSchema))
    siweDto: SiweDto,
  ): Promise<WalletAddedToUser> {
    return await this.usersService.addWalletToUser({
      authPayload,
      siweDto,
    });
  }

  @ApiOkResponse({ description: 'Wallet removed from user and deleted' })
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  @ApiConflictResponse({ description: 'Cannot remove the current wallet' })
  @ApiNotFoundResponse({
    description: 'User OR provided wallet not found',
  })
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
