import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Message } from '@/domain/messages/entities/message.entity';
import { IMessagesRepository } from '@/domain/messages/messages.repository.interface';
import {
  MessagePageSchema,
  MessageSchema,
} from '@/domain/messages/entities/message.entity';
import { MessageVerifierHelper } from '@/domain/messages/helpers/message-verifier.helper';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly messageVerifier: MessageVerifierHelper,
  ) {}

  async getMessageByHash(args: {
    chainId: string;
    messageHash: `0x${string}`;
  }): Promise<Message> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const message = await transactionService.getMessageByHash(args.messageHash);
    return MessageSchema.parse(message);
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Message>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getMessagesBySafe({
      safeAddress: args.safeAddress,
      limit: args.limit,
      offset: args.offset,
    });

    return MessagePageSchema.parse(page);
  }

  async createMessage(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    message: unknown;
    safeAppId: number | null;
    signature: `0x${string}`;
    origin: string | null;
  }): Promise<unknown> {
    const safe = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const response = await transactionService.postMessage({
      safeAddress: args.safeAddress,
      message: args.message,
      safeAppId: args.safeAppId,
      signature: args.signature,
      origin: args.origin,
    });
    const message = MessageSchema.parse(response);
    this.messageVerifier.verifyMessageHash({
      chainId: args.chainId,
      safe,
      expectedHash: message.messageHash,
      message: message.message,
    });
    const signerAddress = await this.messageVerifier.recoverSignerAddress({
      chainId: args.chainId,
      safe,
      message: message.message,
      signature: args.signature,
    });
    const isOwner = safe.owners.includes(signerAddress);
    if (!isOwner) {
      throw new UnprocessableEntityException('Invalid signature');
    }
    return message;
  }

  async updateMessageSignature(args: {
    chainId: string;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<unknown> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.postMessageSignature({
      messageHash: args.messageHash,
      signature: args.signature,
    });
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    await api.clearMessagesBySafe(args);
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    await api.clearMessagesByHash(args);
  }
}
