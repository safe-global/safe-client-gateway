import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { SpacesRepositoryModule } from '@/domain/spaces/spaces.repository.module';
import { MembersRepositoryModule } from '@/domain/users/members.repository.module';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { SpaceSafesController } from '@/routes/spaces/space-safes.controller';
import { SpaceSafesService } from '@/routes/spaces/space-safes.service';
import { SpacesController } from '@/routes/spaces/spaces.controller';
import { SpacesService } from '@/routes/spaces/spaces.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    AuthRepositoryModule,
    SpacesRepositoryModule,
    UserRepositoryModule,
    MembersRepositoryModule,
  ],
  controllers: [SpacesController, SpaceSafesController],
  providers: [SpacesService, SpaceSafesService],
})
export class SpacesModule {}
