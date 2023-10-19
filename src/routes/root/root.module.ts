import { Module } from '@nestjs/common';
import { RootController } from '@/routes/root/root.controller';

@Module({
  controllers: [RootController],
})
export class RootModule {}
