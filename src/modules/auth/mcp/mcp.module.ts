// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth-repository.module';
import { McpElevationRepositoryModule } from '@/modules/auth/mcp/domain/mcp-elevation-repository.module';
import { McpController } from '@/modules/auth/mcp/routes/mcp.controller';
import { McpService } from '@/modules/auth/mcp/routes/mcp.service';
import { McpToolsService } from '@/modules/auth/mcp/routes/mcp-tools.service';
import { OAuthProtectedResourceController } from '@/modules/auth/mcp/routes/oauth-protected-resource.controller';
import { OpenApiCatalogService } from '@/modules/auth/mcp/routes/openapi-catalog.service';
import { Auth0Module } from '@/modules/auth/oidc/auth0/auth0.module';
import { UsersRepositoryModule } from '@/modules/users/domain/users-repository.module';

/**
 * Lets an MCP client, such as a Claude custom connector, call the gateway as an
 * Auth0-authenticated user. Auth0 is the authorization server; this module is
 * the protected resource.
 */
@Module({
  imports: [
    AuthRepositoryModule,
    Auth0Module,
    McpElevationRepositoryModule,
    UsersRepositoryModule,
  ],
  providers: [McpService, McpToolsService, OpenApiCatalogService],
  controllers: [McpController, OAuthProtectedResourceController],
})
export class McpModule {}
