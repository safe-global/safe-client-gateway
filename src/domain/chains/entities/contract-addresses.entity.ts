import { z } from 'zod';
import { ContractAddressesSchema } from '@/domain/chains/entities/schemas/chain.schema';

// Responsible for populating the `ContractNetworksConfig` of the `protocol-kit`
// @see https://docs.safe.global/sdk/protocol-kit/reference/safe#init
export type ContractAddresses = z.infer<typeof ContractAddressesSchema>;
