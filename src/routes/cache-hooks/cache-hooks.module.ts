import { Module } from '@nestjs/common';
import { CacheHooksController } from './cache-hooks.controller';
import { JsonSchemaService } from '../../domain/schema/json-schema.service';
import { CacheHooksService } from './cache-hooks.service';

@Module({
  providers: [JsonSchemaService, CacheHooksService],
  controllers: [CacheHooksController],
})
export class CacheHooksModule {}
