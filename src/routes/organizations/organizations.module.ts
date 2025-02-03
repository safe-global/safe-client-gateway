import { Module } from '@nestjs/common';
import { OrganizationsRepositoryModule } from '@/domain/organizations/organizations.repository.module';
import { OrganizationsController } from '@/routes/organizations/organizations.controller';
import { OrganizationsService } from '@/routes/organizations/organizations.service';

@Module({
  imports: [OrganizationsRepositoryModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
