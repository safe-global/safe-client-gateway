// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { McpElevationRepository } from '@/modules/auth/mcp/domain/mcp-elevation.repository';

describe('McpElevationRepository', () => {
  let target: McpElevationRepository;
  let cacheService: FakeCacheService;
  let configurationService: FakeConfigurationService;
  let request: { userId: number; clientId: string };
  let stateTtlMs: number;
  let elevationWindowSeconds: number;

  beforeEach(() => {
    stateTtlMs = faker.number.int({ min: 60_000, max: 600_000 });
    elevationWindowSeconds = faker.number.int({ min: 60, max: 1_800 });
    configurationService = new FakeConfigurationService();
    configurationService.set('auth.stateTtlMs', stateTtlMs);
    configurationService.set(
      'auth.elevationWindowSeconds',
      elevationWindowSeconds,
    );
    cacheService = new FakeCacheService();
    request = {
      userId: faker.number.int({ min: 1 }),
      clientId: faker.string.alphanumeric(24),
    };

    target = new McpElevationRepository(configurationService, cacheService);
  });

  describe('requests', () => {
    it('should hand out a 32-byte hex id and return the request once', async () => {
      const requestId = await target.createRequest(request);

      expect(requestId).toMatch(/^[0-9a-f]{64}$/);
      await expect(target.consumeRequest(requestId)).resolves.toEqual(request);
      await expect(target.consumeRequest(requestId)).resolves.toBeNull();
    });

    it('should expire a request with the OIDC state', async () => {
      const hSet = vi.spyOn(cacheService, 'hSet');

      const requestId = await target.createRequest(request);

      expect(hSet).toHaveBeenCalledWith(
        CacheRouter.getMcpElevationRequestCacheDir(requestId),
        JSON.stringify(request),
        Math.ceil(stateTtlMs / 1_000),
      );
    });

    it('should return null for an unknown id', async () => {
      await expect(
        target.consumeRequest(faker.string.hexadecimal({ length: 64 })),
      ).resolves.toBeNull();
    });

    it('should not hand the request to a caller that lost the race to delete it', async () => {
      const cacheMock = {
        hGet: vi.fn().mockResolvedValue(JSON.stringify(request)),
        deleteByKey: vi.fn().mockResolvedValue(0),
      } as unknown as MockedObject<ICacheService>;
      const racingTarget = new McpElevationRepository(
        configurationService,
        cacheMock,
      );

      await expect(
        racingTarget.consumeRequest(faker.string.hexadecimal({ length: 64 })),
      ).resolves.toBeNull();
    });
  });

  describe('elevation', () => {
    it('should record a step-up for the connection within the elevation window', async () => {
      const verifiedAt = Math.floor(Date.now() / 1_000);
      const hSet = vi.spyOn(cacheService, 'hSet');

      await target.setElevated({ ...request, verifiedAt });

      await expect(target.getElevatedAt(request)).resolves.toBe(verifiedAt);
      expect(hSet).toHaveBeenCalledWith(
        CacheRouter.getMcpElevationCacheDir(request),
        verifiedAt.toString(),
        elevationWindowSeconds,
      );
    });

    it('should not share a step-up between connections', async () => {
      await target.setElevated({
        ...request,
        verifiedAt: Math.floor(Date.now() / 1_000),
      });

      await expect(
        target.getElevatedAt({
          ...request,
          clientId: faker.string.alphanumeric(24),
        }),
      ).resolves.toBeNull();
    });
  });
});
