import { Module } from '@nestjs/common';
import { OrganizationsRepositoryModule } from '@/domain/organizations/organizations.repository.module';
import { OrganizationsController } from '@/routes/organizations/organizations.controller';
import { OrganizationsService } from '@/routes/organizations/organizations.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';

@Module({
  imports: [
    OrganizationsRepositoryModule,
    AuthRepositoryModule,
    UserRepositoryModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
