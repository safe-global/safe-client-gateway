import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiNoContentResponse,
  ApiCreatedResponse,
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
import { type Address } from 'viem';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Get user with wallets',
    description:
      'Retrieves the authenticated user information along with all associated wallet addresses.',
  })
  @ApiOkResponse({
    type: UserWithWallets,
    description:
      'User information with associated wallets retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiNotFoundResponse({
    description:
      'User not found - the authenticated wallet is not associated with any user',
  })
  @Get()
  @UseGuards(AuthGuard)
  public async getWithWallets(
    @Auth() authPayload: AuthPayload,
  ): Promise<UserWithWallets> {
    return await this.usersService.getWithWallets(authPayload);
  }

  @ApiOperation({
    summary: 'Delete user',
    description:
      'Deletes the authenticated user and all associated data including wallets and account information.',
  })
  @ApiNoContentResponse({
    description: 'User deleted successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiNotFoundResponse({
    description:
      'User not found - the authenticated wallet is not associated with any user',
  })
  @Delete()
  @UseGuards(AuthGuard)
  public async delete(@Auth() authPayload: AuthPayload): Promise<void> {
    return await this.usersService.delete(authPayload);
  }

  // @todo move wallet methods to Wallet controller
  @ApiOperation({
    summary: 'Create user with wallet',
    description:
      'Creates a new user account associated with the authenticated wallet address.',
  })
  @ApiCreatedResponse({
    type: CreatedUserWithWallet,
    description: 'User created successfully with wallet association',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiConflictResponse({
    description:
      'Wallet already exists - this wallet is already associated with a user',
  })
  @Post('/wallet')
  @UseGuards(AuthGuard)
  public async createWithWallet(
    @Auth() authPayload: AuthPayload,
  ): Promise<CreatedUserWithWallet> {
    return await this.usersService.createWithWallet(authPayload);
  }

  @ApiOperation({
    summary: 'Add wallet to user',
    description:
      'Associates an additional wallet address with the authenticated user account using Sign-In with Ethereum (SiWE) verification.',
  })
  @ApiBody({
    type: SiweDto,
    description:
      'Sign-In with Ethereum message and signature for the wallet to add',
  })
  @ApiOkResponse({
    type: WalletAddedToUser,
    description: 'Wallet added to user successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or invalid SiWE message/signature',
  })
  @ApiConflictResponse({
    description:
      'Wallet already exists - this wallet is already associated with a user',
  })
  @ApiNotFoundResponse({
    description:
      'User not found - the authenticated wallet is not associated with any user',
  })
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

  @ApiOperation({
    summary: 'Remove wallet from user',
    description:
      'Removes a wallet address from the authenticated user account. Cannot remove the currently authenticated wallet.',
  })
  @ApiParam({
    name: 'walletAddress',
    type: 'string',
    description: 'Wallet address to remove (0x prefixed hex string)',
  })
  @ApiNoContentResponse({
    description: 'Wallet removed from user successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiConflictResponse({
    description:
      'Cannot remove the current wallet - use a different wallet to authenticate',
  })
  @ApiNotFoundResponse({
    description: 'User or specified wallet not found',
  })
  @Delete('/wallet/:walletAddress')
  @UseGuards(AuthGuard)
  public async deleteWalletFromUser(
    @Param('walletAddress', new ValidationPipe(AddressSchema))
    walletAddress: Address,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.usersService.deleteWalletFromUser({
      authPayload,
      walletAddress,
    });
  }
}
