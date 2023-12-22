import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IEmailRepository } from '@/domain/email/email.repository.interface';

@Injectable()
export class EmailService {
  constructor(
    @Inject(IEmailRepository) private readonly repository: IEmailRepository,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async deleteUnverifiedEmailsOlderThanAWeek(): Promise<void> {
    const today = new Date();
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1_000;
    const oneWeekAgo = new Date(today.getTime() - oneWeekInMs);

    await this.repository.deleteUnverifiedEmailsUntil(oneWeekAgo);
  }

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    account: string;
  }): Promise<void> {
    return this.repository.saveEmail(args);
  }

  async resendVerification(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    return this.repository.resendEmailVerification(args);
  }

  async verifyEmailAddress(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    code: string;
  }): Promise<any> {
    return this.repository.verifyEmailAddress(args);
  }

  async deleteEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    return this.repository.deleteEmail(args);
  }

  async updateEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    emailAddress: string;
  }): Promise<void> {
    return this.repository.updateEmail(args);
  }

  async deleteUnverifiedEmailsUntil(until: Date): Promise<void> {
    return this.repository.deleteUnverifiedEmailsUntil(until);
  }
}
