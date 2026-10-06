// SPDX-License-Identifier: FSL-1.1-MIT

import { Controller, Get, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PROTECTED_RESOURCE_METADATA_PATH } from '@/modules/auth/mcp/routes/utils/protected-resource-metadata.utils';

type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: Array<string>;
  bearer_methods_supported: Array<string>;
};

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP endpoint. An MCP
 * client reads it to learn that Auth0 is where the user signs in.
 *
 * Served both at the well-known root and with the resource path appended, as
 * clients try either form.
 */
@ApiExcludeController()
@Controller({ path: PROTECTED_RESOURCE_METADATA_PATH })
export class OAuthProtectedResourceController {
  private readonly metadata: ProtectedResourceMetadata;

  constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    const auth0Domain =
      configurationService.getOrThrow<string>('auth.auth0.domain');
    this.metadata = {
      resource: configurationService.getOrThrow<string>('mcp.resourceUrl'),
      authorization_servers: [`https://${auth0Domain}/`],
      bearer_methods_supported: ['header'],
    };
  }

  @Get(['', 'v1/mcp'])
  getMetadata(): ProtectedResourceMetadata {
    return this.metadata;
  }
}
