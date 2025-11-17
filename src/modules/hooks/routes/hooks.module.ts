import { Module } from '@nestjs/common';
import { HooksController } from '@/modules/hooks/routes/hooks.controller';
import { HooksRepositoryModule } from '@/modules/hooks/domain/hooks.repository.interface';
import { HooksService } from '@/modules/hooks/routes/hooks.service';

@Module({
  imports: [HooksRepositoryModule],
  providers: [HooksService],
  controllers: [HooksController],
})
export class HooksModule {}
