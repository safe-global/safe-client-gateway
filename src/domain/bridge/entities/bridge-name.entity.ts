import { z } from 'zod';

export const BridgeNames = [
  'hop',
  'cbridge',
  'celercircle',
  'hyphen',
  'optimism',
  'polygon',
  'arbitrum',
  'avalanche',
  'across',
  'stargate',
  'gnosis',
  'omni',
  'amarok',
  'lifuel',
  'celerim',
  'symbiosis',
  'thorswap',
  'squid',
  'allbridge',
  'mayan',
] as const;

export const BridgeNameSchema = z.enum(BridgeNames);

export type BridgeName = z.infer<typeof BridgeNameSchema>;
