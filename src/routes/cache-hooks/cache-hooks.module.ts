import { Module } from '@nestjs/common';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { CacheHooksController } from '@/routes/cache-hooks/cache-hooks.controller';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';

@Module({
  providers: [JsonSchemaService, CacheHooksService],
  controllers: [CacheHooksController],
})
export class CacheHooksModule {}
