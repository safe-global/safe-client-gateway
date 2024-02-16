import { Subscription } from '@/domain/account/entities/subscription.entity';

export const ISubscriptionRepository = Symbol('ISubscriptionRepository');

export interface ISubscriptionRepository {
  getSubscriptions(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<Subscription[]>;

  subscribe(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    notificationTypeKey: string;
  }): Promise<Subscription[]>;

  unsubscribe(args: {
    notificationTypeKey: string;
    token: string;
  }): Promise<Subscription[]>;

  unsubscribeAll(args: { token: string }): Promise<Subscription[]>;
}
