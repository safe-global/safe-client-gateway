// SPDX-License-Identifier: FSL-1.1-MIT
import type Blockaid from '@blockaid/client';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { MaliciousAddressScanner } from '@/modules/safe-shield/malicious-address-scan/malicious-address-scanner.service';

const scan = vi.fn();
const mockClient = {
  evm: { addressBulk: { scan } },
} as unknown as Blockaid;

const hGet = vi.fn();
const hSet = vi.fn();
const mockCacheService = { hGet, hSet } as unknown as ICacheService;

const mockLoggingService = {
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
} as unknown as ILoggingService;

const lowerAddress = (): string =>
  faker.finance.ethereumAddress().toLowerCase();

describe('MaliciousAddressScanner', () => {
  let scanner: MaliciousAddressScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    hGet.mockResolvedValue(null);
    hSet.mockResolvedValue(undefined);
    scanner = new MaliciousAddressScanner(
      mockClient,
      mockCacheService,
      mockLoggingService,
    );
  });

  it('returns only the addresses Blockaid classifies as Malicious', async () => {
    const malicious = lowerAddress();
    const benign = lowerAddress();
    const warning = lowerAddress();
    scan.mockResolvedValue({
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
    scan.mockResolvedValue({ [address]: 'Malicious' });

    const result = await scanner.getMaliciousAddresses('1', [checksummed]);

    expect(result.has(address)).toBe(true);
  });

  it('passes the per-call timeout/retries override', async () => {
    const address = lowerAddress();
    scan.mockResolvedValue({});

    await scanner.getMaliciousAddresses('1', [address]);

    expect(scan).toHaveBeenCalledWith(
      {
        addresses: [address],
        chain: 'ethereum',
        metadata: { domain: 'safe.global' },
      },
      { timeout: 1500, maxRetries: 0 },
    );
  });

  it('fails open (no matches) when Blockaid throws', async () => {
    scan.mockRejectedValue(new Error('blockaid down'));

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
    expect(scan).not.toHaveBeenCalled();
  });

  it('does not call Blockaid for an empty address list', async () => {
    const result = await scanner.getMaliciousAddresses('1', []);

    expect(result.size).toBe(0);
    expect(scan).not.toHaveBeenCalled();
  });

  it('deduplicates addresses before scanning', async () => {
    const address = lowerAddress();
    scan.mockResolvedValue({ [address]: 'Benign' });

    await scanner.getMaliciousAddresses('1', [address, address.toUpperCase()]);

    expect(scan).toHaveBeenCalledOnce();
    expect(scan).toHaveBeenCalledWith(
      expect.objectContaining({ addresses: [address] }),
      expect.anything(),
    );
  });

  it('serves cached verdicts without scanning', async () => {
    const malicious = lowerAddress();
    const safe = lowerAddress();
    hGet.mockImplementation((cacheDir: { key: string }) =>
      Promise.resolve(cacheDir.key.endsWith(malicious) ? 'malicious' : 'safe'),
    );

    const result = await scanner.getMaliciousAddresses('1', [malicious, safe]);

    expect(scan).not.toHaveBeenCalled();
    expect(result).toEqual(new Set([malicious]));
  });

  it('caches scanned verdicts with a TTL', async () => {
    const malicious = lowerAddress();
    const benign = lowerAddress();
    scan.mockResolvedValue({ [malicious]: 'Malicious', [benign]: 'Benign' });

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
    scan.mockResolvedValue({});

    await scanner.getMaliciousAddresses('1', many);

    expect(scan).toHaveBeenCalledTimes(2);
    expect(scan.mock.calls[0][0].addresses).toHaveLength(100);
    expect(scan.mock.calls[1][0].addresses).toHaveLength(50);
  });

  it('falls through to a live scan when the cache read errors', async () => {
    const malicious = lowerAddress();
    hGet.mockRejectedValue(new Error('redis down'));
    scan.mockResolvedValue({ [malicious]: 'Malicious' });

    const result = await scanner.getMaliciousAddresses('1', [malicious]);

    expect(scan).toHaveBeenCalledOnce();
    expect(result).toEqual(new Set([malicious]));
  });
});
