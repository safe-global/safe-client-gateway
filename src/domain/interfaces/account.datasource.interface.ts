import {
  Account,
  EmailAddress,
} from '@/domain/account/entities/account.entity';
import { Subscription } from '@/domain/account/entities/subscription.entity';

export const IAccountDataSource = Symbol('IAccountDataSource');

export interface IAccountDataSource {
  /**
   * Gets the verified emails associated with a Safe address.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to use as filter
   */
  getVerifiedAccountEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ email: string }[]>;

  /**
   * Gets the email associated with an account of a Safe for a specific chain.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to use as filter
   * @param args.account - the owner address to which link the email address is linked to
   */
  getAccount(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<Account>;

  /**
   * Saves an email entry in the respective data source.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.emailAddress - the email address to store
   * @param args.account - the owner address to which we should link the email address to
   * @param args.code - the generated code to be used to verify this email address
   * @param args.verificationGeneratedOn – the date which represents when the code was generated
   */
  saveAccount(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    account: string;
    code: string;
    codeGenerationDate: Date;
    unsubscriptionToken: string;
  }): Promise<void>;

  /**
   * Sets the verification code for an email entry.
   *
   * If the reset was successful, the new verification code is returned.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address
   * @param args.account - the owner address
   * @param args.code - the generated code to be used to verify this email address
   * @param args.verificationGeneratedOn – the date which represents when the code was generated
   */
  setVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    code: string;
    codeGenerationDate: Date;
  }): Promise<void>;

  /**
   * Sets the verification date for an email entry.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address
   * @param args.account - the owner address
   * @param args.sent_on - the verification-sent date
   */
  setVerificationSentDate(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    sentOn: Date;
  }): Promise<void>;

  /**
   * Verifies the email address for an account of a Safe.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address
   * @param args.account - the owner address
   */
  verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void>;

  /**
   * Deletes an email address for a given account.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should remove the email address from
   * @param args.account - the owner address to which we should remove the email address from
   */
  deleteAccount(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void>;

  /**
   * Updates an email entry in the respective data source.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.emailAddress - the email address to store
   * @param args.account - the owner address to which we should link the email address to
   * @param args.code - the generated code to be used to verify this email address
   * @param args.verificationGeneratedOn – the date which represents when the code was generated
   */
  updateAccountEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    account: string;
    code: string;
    codeGenerationDate: Date;
    unsubscriptionToken: string;
  }): Promise<void>;

  /**
   * Gets all the subscriptions for the account on chainId, with the specified safeAddress
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which the email address is linked to
   * @param args.account - the owner address to which the email address is linked to
   */
  getSubscriptions(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<Subscription[]>;

  /**
   * Subscribes the account on chainId, with the safeAddress to a category
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which the email address is linked to
   * @param args.account - the owner address to which we email address is linked to
   * @param args.categoryKey - the category key to subscribe to
   *
   * @returns The Subscriptions that were successfully subscribed to
   */
  subscribe(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    categoryKey: string;
  }): Promise<Subscription[]>;

  /**
   * Unsubscribes from the notification category with the provided category key.
   *
   * If the category key or the token are incorrect, no subscriptions are returned from this call.
   *
   * @param args.categoryKey - the category key to unsubscribe
   * @param args.token - the unsubscription token (tied to a single account)
   *
   * @returns The Subscriptions that were successfully unsubscribed.
   */
  unsubscribe(args: {
    categoryKey: string;
    token: string;
  }): Promise<Subscription[]>;

  /**
   * Unsubscribes from all notification categories.
   *
   * If the category key or the token are incorrect, no subscriptions are returned from this call.
   *
   * @param args.categoryKey - the category key to unsubscribe
   * @param args.token - the unsubscription token (tied to a single account)
   *
   * @returns The Subscriptions that were successfully unsubscribed.
   */
  unsubscribeAll(args: { token: string }): Promise<Subscription[]>;
}
