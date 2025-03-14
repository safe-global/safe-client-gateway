import { Module } from '@nestjs/common';
import { HooksController } from '@/routes/hooks/hooks.controller';
import { HooksRepositoryModule } from '@/domain/hooks/hooks.repository.interface';
import { HooksService } from '@/routes/hooks/hooks.service';

@Module({
  imports: [HooksRepositoryModule],
  providers: [HooksService],
  controllers: [HooksController],
})
export class HooksModule {}
