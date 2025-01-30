import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { UsersService } from '@/routes/users/users.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { UserWithWallets } from '@/routes/users/entities/user-with-wallets.entity';
import type { CreatedUserWithWallet } from '@/routes/users/entities/created-user-with-wallet.entity';

// TODO: Specify error responses for Swagger

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @HttpCode(HttpStatus.OK)
  @Get()
  @UseGuards(AuthGuard)
  public async getUseWithWallets(
    @Auth() authPayload: AuthPayload,
  ): Promise<UserWithWallets> {
    return await this.usersService.getUserWithWallets(authPayload);
  }

  @HttpCode(HttpStatus.OK)
  @Delete()
  @UseGuards(AuthGuard)
  public async deleteUser(@Auth() authPayload: AuthPayload): Promise<void> {
    return await this.usersService.deleteUser(authPayload);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/wallet')
  @UseGuards(AuthGuard)
  public async createUserWithWallet(
    @Auth() authPayload: AuthPayload,
  ): Promise<CreatedUserWithWallet> {
    return await this.usersService.createUserWithWallet(authPayload);
  }

  @HttpCode(HttpStatus.CREATED)
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
