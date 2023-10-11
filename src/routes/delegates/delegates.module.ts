import { Module } from '@nestjs/common';
import { ValidationModule } from '@/validation/validation.module';
import { DelegatesController } from '@/routes/delegates/delegates.controller';
import { DelegatesService } from '@/routes/delegates/delegates.service';

@Module({
  controllers: [DelegatesController],
  providers: [DelegatesService],
  imports: [ValidationModule],
})
export class DelegatesModule {}
