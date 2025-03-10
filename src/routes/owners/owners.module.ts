import { Module } from '@nestjs/common';
import { OwnersControllerV1 } from '@/routes/owners/owners.controller.v1';
import { OwnersControllerV2 } from '@/routes/owners/owners.controller.v2';
import { OwnersService } from '@/routes/owners/owners.service';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';

@Module({
  imports: [SafeRepositoryModule],
  controllers: [OwnersControllerV1, OwnersControllerV2],
  providers: [OwnersService],
})
export class OwnersModule {}
