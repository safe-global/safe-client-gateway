import { Module } from '@nestjs/common';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { AuthService } from '../common/auth/auth-service';
import { AuthModule } from '../common/auth/auth.module';
import { CacheHooksController } from './cache-hooks.controller';
import { CacheHooksService } from './cache-hooks.service';

@Module({
  controllers: [CacheHooksController],
  imports: [AuthModule],
  providers: [JsonSchemaService, CacheHooksService, AuthService],
})
export class CacheHooksModule {}
