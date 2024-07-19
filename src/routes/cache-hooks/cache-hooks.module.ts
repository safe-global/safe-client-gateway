import { Module } from '@nestjs/common';
import { CacheHooksController } from '@/routes/cache-hooks/cache-hooks.controller';
import { HooksRepositoryModule } from '@/domain/hooks/hooks.repository.interface';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';

@Module({
  imports: [HooksRepositoryModule],
  providers: [CacheHooksService],
  controllers: [CacheHooksController],
})
export class CacheHooksModule {}
