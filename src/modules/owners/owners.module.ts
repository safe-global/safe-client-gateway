import { Module } from '@nestjs/common';
import { OwnersControllerV1 } from '@/modules/owners/routes/owners.controller.v1';
import { OwnersControllerV2 } from '@/modules/owners/routes/owners.controller.v2';
import { OwnersService } from '@/modules/owners/routes/owners.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';

@Module({
  imports: [SafeRepositoryModule],
  controllers: [OwnersControllerV1, OwnersControllerV2],
  providers: [OwnersService],
})
export class OwnersModule {}
