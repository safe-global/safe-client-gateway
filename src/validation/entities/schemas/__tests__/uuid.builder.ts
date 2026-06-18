// SPDX-License-Identifier: FSL-1.1-MIT

import type { UUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';

export const fakeUuid = (): UUID => UuidSchema.parse(faker.string.uuid());
