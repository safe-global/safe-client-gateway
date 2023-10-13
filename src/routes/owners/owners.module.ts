import { Module } from '@nestjs/common';
import { OwnersController } from '@/routes/owners/owners.controller';
import { OwnersService } from '@/routes/owners/owners.service';

@Module({
  controllers: [OwnersController],
  providers: [OwnersService],
})
export class OwnersModule {}
