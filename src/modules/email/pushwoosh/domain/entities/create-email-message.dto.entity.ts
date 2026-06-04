// SPDX-License-Identifier: FSL-1.1-MIT
export class CreateEmailMessageDto {
  to!: Array<string>;
  template!: string;
  subject!: string;
  substitutions!: Record<string, unknown> | null;
  emailMessageId?: string;
}
