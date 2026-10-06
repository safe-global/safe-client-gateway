// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { CacheModule } from '@/datasources/cache/cache.module';
import { McpElevationRepository } from '@/modules/auth/mcp/domain/mcp-elevation.repository';
import { IMcpElevationRepository } from '@/modules/auth/mcp/domain/mcp-elevation.repository.interface';

/**
 * Shared by {@link McpModule}, which opens step-ups, and {@link OidcAuthModule},
 * whose callback completes them.
 */
@Module({
  imports: [CacheModule],
  providers: [
    { provide: IMcpElevationRepository, useClass: McpElevationRepository },
  ],
  exports: [IMcpElevationRepository],
})
export class McpElevationRepositoryModule {}
