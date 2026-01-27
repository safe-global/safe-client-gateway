import { Module } from '@nestjs/common';
import { OwnersControllerV1 } from '@/modules/owners/routes/owners.controller.v1';
import { OwnersControllerV2 } from '@/modules/owners/routes/owners.controller.v2';
import { OwnersControllerV3 } from '@/modules/owners/routes/owners.controller.v3';
import { OwnersService } from '@/modules/owners/routes/owners.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';

@Module({
  imports: [SafeRepositoryModule],
  controllers: [OwnersControllerV1, OwnersControllerV2, OwnersControllerV3],
  providers: [OwnersService],
})
export class OwnersModule {}
