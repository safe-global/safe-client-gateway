// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { SendEmailJobData } from '@/modules/email/ses/domain/entities/email-job-data.entity';

export function sendEmailJobDataBuilder(): IBuilder<SendEmailJobData> {
  return new Builder<SendEmailJobData>()
    .with('to', faker.internet.email())
    .with('subject', faker.lorem.sentence())
    .with('htmlBody', `<p>${faker.lorem.paragraph()}</p>`)
    .with('textBody', faker.lorem.paragraph());
}
