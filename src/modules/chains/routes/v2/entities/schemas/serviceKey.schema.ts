// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Service key for scoping chain features (e.g., WALLET_WEB, MOBILE)
 * This is used to identify the service that is requesting the chain data.
 * It is passed as a query parameter to the v2 chains endpoint.
 */
export enum ServiceKey {
  WALLET_WEB = 'WALLET_WEB',
  MOBILE = 'MOBILE',
  CGW = 'CGW',
}

const serviceKeyErrorMessage = 'serviceKey query parameter is required';

export const ServiceKeyQuerySchema = z
  .string(serviceKeyErrorMessage)
  .min(1, serviceKeyErrorMessage);
