import { Module } from '@nestjs/common';
import { OwnersController } from '@/routes/owners/owners.controller';
import { OwnersService } from '@/routes/owners/owners.service';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';

@Module({
  imports: [SafeRepositoryModule],
  controllers: [OwnersController],
  providers: [OwnersService],
})
export class OwnersModule {}
