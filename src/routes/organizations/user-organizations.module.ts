import { Module } from '@nestjs/common';
import { UsersOrganizationsRepositoryModule } from '@/domain/users/user-organizations.repository.module';
import { UserOrganizationsController } from '@/routes/organizations/user-organizations.controller';
import { UserOrganizationsService } from '@/routes/organizations/user-organizations.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { WalletsRepositoryModule } from '@/domain/wallets/wallets.repository.module';

@Module({
  imports: [
    UsersOrganizationsRepositoryModule,
    AuthRepositoryModule,
    WalletsRepositoryModule,
  ],
  controllers: [UserOrganizationsController],
  providers: [UserOrganizationsService],
})
export class UserOrganizationsModule {}
