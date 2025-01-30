import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { UsersService } from '@/routes/users/users.service';
import { UserWithWallets } from '@/routes/users/entities/user-with-wallets.entity';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard)
  public get(@Auth() authPayload: AuthPayload): Promise<UserWithWallets> {
    return this.usersService.getUserWithWallet(authPayload);
  }
}
