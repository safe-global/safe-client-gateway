import { z } from 'zod';

/**
 * Asset ID schema for validation
 * Asset IDs are human-readable slugs like 'dai', 'eth', 'morpho'
 * With optional collision suffixes like 'weth-c02a'
 */
export const AssetIdSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/);

export type AssetId = z.infer<typeof AssetIdSchema>;

/**
 * Asset metadata used internally by the registry
 */
export type AssetMetadata = {
  assetId: string;
  symbol: string;
  name: string;
  isCanonical: boolean;
  providerIds: Record<string, string>;
};

/**
 * Creates a slug from a symbol by:
 * 1. Converting to lowercase
 * 2. Removing non-alphanumeric characters
 * 3. Truncating to 20 characters
 *
 * Examples:
 * - "ETH" -> "eth"
 * - "DAI" -> "dai"
 * - "Wrapped ETH" -> "wrappedeth"
 * - "USD Coin" -> "usdcoin"
 */
export function createSlug(symbol: string): string {
  return symbol
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

/**
 * Creates an address-based suffix from an Ethereum address
 * Takes the first 4 characters after '0x'
 *
 * Examples:
 * - "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" -> "c02a"
 * - "0x6B175474E89094C44Da98b954EedeAC495271d0F" -> "6b17"
 */
export function createAddressSuffix(address: string): string {
  const normalized = address.toLowerCase();
  if (normalized.startsWith('0x') && normalized.length >= 6) {
    return normalized.slice(2, 6);
  }
  return normalized.slice(0, 4);
}

/**
 * Creates a collision-resolved asset ID using:
 * 1. Base slug from symbol
 * 2. Address suffix if collision occurs and address available
 * 3. Numeric counter if still colliding
 *
 * @param symbol - Token symbol (e.g., "WETH")
 * @param address - Token address (e.g., "0xC02aaA...")
 * @param existingIds - Set of already-used asset IDs
 * @returns Unique asset ID
 *
 * Examples:
 * - First WETH: "weth"
 * - Second WETH with address 0xC02a...: "weth-c02a"
 * - Third WETH with address 0xC02a... (collision): "weth-c02a-2"
 */
export function createAssetId(
  symbol: string,
  address: string | null,
  existingIds: Set<string>,
): string {
  const baseSlug = createSlug(symbol);

  // Try base slug first
  if (!existingIds.has(baseSlug)) {
    return baseSlug;
  }

  // Try with address suffix
  if (address) {
    const addressSuffix = createAddressSuffix(address);
    const slugWithAddress = `${baseSlug}-${addressSuffix}`;

    if (!existingIds.has(slugWithAddress)) {
      return slugWithAddress;
    }

    // Try with counter if address suffix also collides
    let counter = 2;
    while (existingIds.has(`${slugWithAddress}-${counter}`)) {
      counter++;
    }
    return `${slugWithAddress}-${counter}`;
  }

  // No address, use counter fallback
  let counter = 2;
  while (existingIds.has(`${baseSlug}-${counter}`)) {
    counter++;
  }
  return `${baseSlug}-${counter}`;
}
