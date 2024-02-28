import { Inject, Injectable } from '@nestjs/common';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { ISubscriptionRepository } from '@/domain/subscriptions/subscription.repository.interface';
import { Subscription } from '@/domain/account/entities/subscription.entity';
import { getAddress } from 'viem';

@Injectable()
export class SubscriptionRepository implements ISubscriptionRepository {
  public static CATEGORY_ACCOUNT_RECOVERY = 'account_recovery';

  constructor(
    @Inject(IAccountDataSource)
    private readonly accountDataSource: IAccountDataSource,
  ) {}

  getSubscriptions(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<Subscription[]> {
    const safeAddress = getAddress(args.safeAddress);
    const signer = getAddress(args.signer);
    return this.accountDataSource.getSubscriptions({
      chainId: args.chainId,
      safeAddress,
      signer,
    });
  }

  subscribe(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    notificationTypeKey: string;
  }): Promise<Subscription[]> {
    const safeAddress = getAddress(args.safeAddress);
    const signer = getAddress(args.signer);
    return this.accountDataSource.subscribe({
      chainId: args.chainId,
      safeAddress,
      signer,
      notificationTypeKey: args.notificationTypeKey,
    });
  }

  unsubscribe(args: {
    notificationTypeKey: string;
    token: string;
  }): Promise<Subscription[]> {
    return this.accountDataSource.unsubscribe(args);
  }

  unsubscribeAll(args: { token: string }): Promise<Subscription[]> {
    return this.accountDataSource.unsubscribeAll(args);
  }
}
