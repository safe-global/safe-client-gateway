// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Response of the MFA API `POST /mfa/associate` call for an `otp`
 * authenticator: the provider-generated secret and its `otpauth://` URI,
 * rendered client-side as a QR code.
 */
export const Auth0OtpAssociationSchema = z.object({
  authenticator_type: z.literal('otp'),
  secret: z.string().min(1),
  barcode_uri: z.string().min(1),
});

export type Auth0OtpAssociation = z.infer<typeof Auth0OtpAssociationSchema>;
