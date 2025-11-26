import { Module } from '@nestjs/common';
import { MembersRepositoryModule } from '@/modules/users/domain/members.repository.module';
import { UserRepositoryModule } from '@/modules/users/domain/users.repository.module';
import { UsersController } from '@/modules/users/routes/users.controller';
import { UsersService } from '@/modules/users/routes/users.service';
import { AuthModule } from '@/modules/auth/auth.module';
import { WalletsModule } from '@/modules/wallets/wallets.module';
import { SiweModule } from '@/modules/siwe/siwe.module';

@Module({
  imports: [
    MembersRepositoryModule,
    UserRepositoryModule,
    WalletsModule,
    AuthModule,
    SiweModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
