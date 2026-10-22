// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';

export const AddRecoveryModuleDtoSchema = z.object({
  moduleAddress: AddressSchema,
});
