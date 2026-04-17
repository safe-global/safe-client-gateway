// SPDX-License-Identifier: FSL-1.1-MIT
import { ConflictException } from '@nestjs/common';
export class UniqueConstraintError extends ConflictException {}
