// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { MaliciousAddressScanner } from '@/modules/safe-shield/malicious-address-scan/malicious-address-scanner.service';
import type { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';

const scanAddressBulk = vi.fn();
const mockBlockaidApi = { scanAddressBulk } as MockedObject<IBlockaidApi>;

const hGet = vi.fn();
const hSet = vi.fn();
const mockCacheService = { hGet, hSet } as MockedObject<ICacheService>;

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const fakeConfigurationService = new FakeConfigurationService();
fakeConfigurationService.set(
  'safeShield.maliciousAddressScan.maxBatchSize',
  100,
);
fakeConfigurationService.set(
  'safeShield.maliciousAddressScan.cacheTtlSeconds',
  300,
);

const lowerAddress = (): string =>
  faker.finance.ethereumAddress().toLowerCase();

describe('MaliciousAddressScanner', () => {
  let scanner: MaliciousAddressScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    hGet.mockResolvedValue(null);
    hSet.mockResolvedValue(undefined);
    scanner = new MaliciousAddressScanner(
      mockBlockaidApi,
      mockCacheService,
      mockLoggingService,
      fakeConfigurationService,
    );
  });

  it('returns only the addresses Blockaid classifies as Malicious', async () => {
    const malicious = lowerAddress();
    const benign = lowerAddress();
    const warning = lowerAddress();
    scanAddressBulk.mockResolvedValue({
      [malicious]: 'Malicious',
      [benign]: 'Benign',
      [warning]: 'Warning',
    });

    const result = await scanner.getMaliciousAddresses('1', [
      malicious,
      benign,
      warning,
    ]);

    expect(result).toEqual(new Set([malicious]));
  });

  it('matches case-insensitively (checksummed input, lowercased response)', async () => {
    const address = lowerAddress();
    const checksummed = getAddress(address);
    scanAddressBulk.mockResolvedValue({ [address]: 'Malicious' });

    const result = await scanner.getMaliciousAddresses('1', [checksummed]);

    expect(result.has(address)).toBe(true);
  });

  it('scans via the Blockaid API with the mapped chain name', async () => {
    const address = lowerAddress();
    scanAddressBulk.mockResolvedValue({});

    await scanner.getMaliciousAddresses('1', [address]);

    expect(scanAddressBulk).toHaveBeenCalledWith('ethereum', [address]);
  });

  it('fails open (no matches) when Blockaid throws', async () => {
    scanAddressBulk.mockRejectedValue(new Error('blockaid down'));

    const result = await scanner.getMaliciousAddresses('1', [lowerAddress()]);

    expect(result.size).toBe(0);
    expect(mockLoggingService.warn).toHaveBeenCalledOnce();
  });

  it('skips unsupported chains without calling Blockaid', async () => {
    const result = await scanner.getMaliciousAddresses(
      faker.string.numeric(7),
      [lowerAddress()],
    );

    expect(result.size).toBe(0);
    expect(scanAddressBulk).not.toHaveBeenCalled();
  });

  it('does not call Blockaid for an empty address list', async () => {
    const result = await scanner.getMaliciousAddresses('1', []);

    expect(result.size).toBe(0);
    expect(scanAddressBulk).not.toHaveBeenCalled();
  });

  it('deduplicates addresses before scanning', async () => {
    const address = lowerAddress();
    scanAddressBulk.mockResolvedValue({ [address]: 'Benign' });

    await scanner.getMaliciousAddresses('1', [address, address.toUpperCase()]);

    expect(scanAddressBulk).toHaveBeenCalledOnce();
    expect(scanAddressBulk).toHaveBeenCalledWith('ethereum', [address]);
  });

  it('serves cached verdicts without scanning', async () => {
    const malicious = lowerAddress();
    const safe = lowerAddress();
    hGet.mockImplementation((cacheDir: { key: string }) =>
      Promise.resolve(cacheDir.key.endsWith(malicious) ? 'malicious' : 'safe'),
    );

    const result = await scanner.getMaliciousAddresses('1', [malicious, safe]);

    expect(scanAddressBulk).not.toHaveBeenCalled();
    expect(result).toEqual(new Set([malicious]));
  });

  it('caches scanned verdicts with a TTL', async () => {
    const malicious = lowerAddress();
    const benign = lowerAddress();
    scanAddressBulk.mockResolvedValue({
      [malicious]: 'Malicious',
      [benign]: 'Benign',
    });

    await scanner.getMaliciousAddresses('1', [malicious, benign]);

    expect(hSet).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.stringContaining(malicious) }),
      'malicious',
      300,
    );
    expect(hSet).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.stringContaining(benign) }),
      'safe',
      300,
    );
  });

  it('chunks batches larger than the max (bot-sized owner)', async () => {
    const many = Array.from({ length: 150 }, lowerAddress);
    scanAddressBulk.mockResolvedValue({});

    await scanner.getMaliciousAddresses('1', many);

    expect(scanAddressBulk).toHaveBeenCalledTimes(2);
    expect(scanAddressBulk).toHaveBeenNthCalledWith(
      1,
      'ethereum',
      many.slice(0, 100),
    );
    expect(scanAddressBulk).toHaveBeenNthCalledWith(
      2,
      'ethereum',
      many.slice(100),
    );
  });

  it('falls through to a live scan when the cache read errors', async () => {
    const malicious = lowerAddress();
    hGet.mockRejectedValue(new Error('redis down'));
    scanAddressBulk.mockResolvedValue({ [malicious]: 'Malicious' });

    const result = await scanner.getMaliciousAddresses('1', [malicious]);

    expect(scanAddressBulk).toHaveBeenCalledOnce();
    expect(result).toEqual(new Set([malicious]));
  });
});
