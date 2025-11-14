import { Module } from '@nestjs/common';
import { UserRepositoryModule } from '@/modules/users/domain/users.repository.module';
import { UsersController } from '@/modules/users/routes/users.controller';
import { UsersService } from '@/modules/users/routes/users.service';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth.repository.interface';
import { WalletsRepositoryModule } from '@/modules/wallets/domain/wallets.repository.module';
import { SiweRepositoryModule } from '@/modules/siwe/domain/siwe.repository.interface';

@Module({
  imports: [
    UserRepositoryModule,
    WalletsRepositoryModule,
    AuthRepositoryModule,
    SiweRepositoryModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
