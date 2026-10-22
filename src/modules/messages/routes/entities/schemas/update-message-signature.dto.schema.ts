// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { SignatureSchema } from '#/validation/entities/schemas/signature.schema';

export const UpdateMessageSignatureDtoSchema = z.object({
  signature: SignatureSchema,
});
