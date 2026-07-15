// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export type SubscriptionMetadata = z.infer<typeof SubscriptionMetadataSchema>;

// Mirrors the flat metadata dict billing-service attaches to a subscription
// webhook event — see BillingWebhookSubscriptionDataSchema['metadata'].
export const SubscriptionMetadataSchema = z.record(z.string(), z.string());
