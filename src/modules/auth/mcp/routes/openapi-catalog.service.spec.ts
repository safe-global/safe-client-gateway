// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { HttpAdapterHost } from '@nestjs/core';
import { OpenApiCatalogService } from '@/modules/auth/mcp/routes/openapi-catalog.service';

describe('OpenApiCatalogService', () => {
  let target: OpenApiCatalogService;
  let inject: ReturnType<typeof vi.fn>;

  const spaceSummary = faker.lorem.sentence();
  const document = {
    paths: {
      '/v1/spaces': {
        get: {
          operationId: 'spacesGet',
          summary: spaceSummary,
          tags: ['spaces'],
        },
        post: {
          operationId: 'spacesCreate',
          tags: ['spaces'],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateSpaceDto' },
              },
            },
          },
        },
      },
      '/v1/spaces/{id}': {
        parameters: [],
        get: {
          operationId: 'spacesGetOne',
          tags: ['spaces'],
          responses: {
            '200': {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Space' },
                },
              },
            },
            '404': { description: 'Not found' },
          },
        },
      },
      '/v1/chains/{chainId}/safes/{safeAddress}': {
        get: { operationId: 'safesGetSafe', tags: ['safes'] },
      },
    },
    components: {
      schemas: {
        CreateSpaceDto: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
        Space: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            parent: { $ref: '#/components/schemas/Space' },
          },
        },
      },
    },
  };

  beforeEach(() => {
    inject = vi.fn().mockResolvedValue({ json: () => document });
    const httpAdapterHost = {
      httpAdapter: { getInstance: () => ({ inject }) },
    } as unknown as HttpAdapterHost;

    target = new OpenApiCatalogService(httpAdapterHost);
  });

  describe('search', () => {
    it('should list every endpoint without a query', async () => {
      const result = await target.search(undefined);

      expect(result.map(({ method, path }) => `${method} ${path}`)).toEqual([
        'GET /v1/spaces',
        'POST /v1/spaces',
        'GET /v1/spaces/{id}',
        'GET /v1/chains/{chainId}/safes/{safeAddress}',
      ]);
      expect(inject).toHaveBeenCalledWith({ method: 'GET', url: '/api-json' });
    });

    it('should match every word case-insensitively', async () => {
      const result = await target.search('POST Spaces');

      expect(result).toEqual([
        {
          method: 'POST',
          path: '/v1/spaces',
          summary: undefined,
          tags: ['spaces'],
          deprecated: undefined,
        },
      ]);
    });

    it('should search summaries', async () => {
      const result = await target.search(spaceSummary);

      expect(result).toEqual([
        expect.objectContaining({ method: 'GET', path: '/v1/spaces' }),
      ]);
    });

    it('should load the document once', async () => {
      await target.search(undefined);
      await target.search('spaces');

      expect(inject).toHaveBeenCalledTimes(1);
    });

    it('should retry loading after a failure', async () => {
      inject.mockRejectedValueOnce(new Error('not ready'));

      await expect(target.search(undefined)).rejects.toThrow('not ready');
      await expect(target.search(undefined)).resolves.toHaveLength(4);
    });
  });

  describe('describe', () => {
    it('should inline schema references in the request body', async () => {
      const result = await target.describe('POST', '/v1/spaces');

      expect(result?.requestBody).toEqual({
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { name: { type: 'string' } },
            },
          },
        },
      });
    });

    it('should keep only success responses and stop at recursive references', async () => {
      const result = await target.describe('GET', '/v1/spaces/{id}');

      expect(result?.responses).toEqual({
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  parent: { $ref: '#/components/schemas/Space' },
                },
              },
            },
          },
        },
      });
    });

    it('should return undefined for an unknown endpoint', async () => {
      await expect(
        target.describe('DELETE', '/v1/spaces/{id}'),
      ).resolves.toBeUndefined();
    });
  });

  describe('findEndpoint', () => {
    it('should match a concrete path to its template', async () => {
      const safeAddress = faker.finance.ethereumAddress();

      await expect(
        target.findEndpoint('GET', `/v1/chains/1/safes/${safeAddress}`),
      ).resolves.toEqual({
        method: 'GET',
        path: '/v1/chains/{chainId}/safes/{safeAddress}',
      });
    });

    it('should tolerate a trailing slash', async () => {
      await expect(
        target.findEndpoint('GET', '/v1/spaces/12/'),
      ).resolves.toEqual({ method: 'GET', path: '/v1/spaces/{id}' });
    });

    it('should not let a parameter span several segments', async () => {
      await expect(
        target.findEndpoint('GET', '/v1/spaces/12/members'),
      ).resolves.toBeUndefined();
    });

    it('should not match another method', async () => {
      await expect(
        target.findEndpoint('DELETE', '/v1/spaces/12'),
      ).resolves.toBeUndefined();
    });
  });
});
