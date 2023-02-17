import { faker } from '@faker-js/faker';
import { range } from 'lodash';
import { DataSourceError } from '../../../domain/errors/data-source.error';
import { messageConfirmationBuilder } from '../../../domain/messages/entities/__tests__/message-confirmation.builder';
import { messageBuilder } from '../../../domain/messages/entities/__tests__/message.builder';
import { safeAppBuilder } from '../../../domain/safe-apps/entities/__tests__/safe-app.builder';
import { SafeAppsRepository } from '../../../domain/safe-apps/safe-apps.repository';
import { safeBuilder } from '../../../domain/safe/entities/__tests__/safe.builder';
import { AddressInfoHelper } from '../../common/address-info/address-info.helper';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { MessageConfirmation } from '../entities/message-confirmation.entity';
import { Message, MessageStatus } from '../entities/message.entity';
import { MessageMapper } from './message-mapper';

describe('Message mapper (Unit)', () => {
  let mapper: MessageMapper;

  const addressInfoHelperMock = jest.mocked({
    getOrDefault: jest.fn(),
  } as unknown as AddressInfoHelper);

  const safeAppsRepositoryMock = jest.mocked({
    getSafeAppById: jest.fn(),
  } as unknown as SafeAppsRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new MessageMapper(safeAppsRepositoryMock, addressInfoHelperMock);
  });

  it('should forward errors', async () => {
    const chainId = faker.random.numeric();
    const message = messageBuilder().build();
    const safe = safeBuilder().build();
    const expected = new DataSourceError(faker.random.words());
    safeAppsRepositoryMock.getSafeAppById.mockRejectedValue(expected);

    await expect(
      mapper.mapMessage(chainId, message, safe),
    ).rejects.toThrowError(expected);

    expect(safeAppsRepositoryMock.getSafeAppById).toHaveBeenCalledTimes(1);
  });

  it('should return a CONFIRMED status if safe threshold <= message confirmations', async () => {
    const chainId = faker.random.numeric();
    const safeApp = safeAppBuilder().build();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const messageConfirmations = range(5).map(() =>
      messageConfirmationBuilder().build(),
    );
    const message = messageBuilder()
      .with('confirmations', messageConfirmations)
      .build();
    const safe = safeBuilder()
      .with(
        'threshold',
        faker.datatype.number({ max: messageConfirmations.length }),
      )
      .build();
    safeAppsRepositoryMock.getSafeAppById.mockResolvedValue(safeApp);
    addressInfoHelperMock.getOrDefault.mockResolvedValue(addressInfo);

    const actual = await mapper.mapMessage(chainId, message, safe);

    expect(actual).toEqual(
      new Message(
        message.messageHash,
        MessageStatus.Confirmed,
        safeApp.iconUrl,
        safeApp.name,
        message.message,
        message.created.getTime(),
        message.modified.getTime(),
        messageConfirmations.length,
        safe.threshold,
        addressInfo,
        messageConfirmations.map(
          (messageConfirmation) =>
            new MessageConfirmation(addressInfo, messageConfirmation.signature),
        ),
        message.preparedSignature,
      ),
    );
  });

  it('should return an NEEDS_CONFIRMATION status and a null preparedSignature if safe threshold > message confirmations', async () => {
    const chainId = faker.random.numeric();
    const safeApp = safeAppBuilder().build();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const messageConfirmations = range(5).map(() =>
      messageConfirmationBuilder().build(),
    );
    const message = messageBuilder()
      .with('confirmations', messageConfirmations)
      .build();
    const safe = safeBuilder()
      .with(
        'threshold',
        faker.datatype.number({ min: messageConfirmations.length + 1 }),
      )
      .build();
    safeAppsRepositoryMock.getSafeAppById.mockResolvedValue(safeApp);
    addressInfoHelperMock.getOrDefault.mockResolvedValue(addressInfo);

    const actual = await mapper.mapMessage(chainId, message, safe);

    expect(actual).toEqual(
      new Message(
        message.messageHash,
        MessageStatus.NeedsConfirmation,
        safeApp.iconUrl,
        safeApp.name,
        message.message,
        message.created.getTime(),
        message.modified.getTime(),
        messageConfirmations.length,
        safe.threshold,
        addressInfo,
        messageConfirmations.map(
          (messageConfirmation) =>
            new MessageConfirmation(addressInfo, messageConfirmation.signature),
        ),
        null,
      ),
    );
  });

  it('should return null name and logo if the Safe App is not found', async () => {
    const chainId = faker.random.numeric();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const messageConfirmations = range(5).map(() =>
      messageConfirmationBuilder().build(),
    );
    const message = messageBuilder()
      .with('confirmations', messageConfirmations)
      .build();
    const safe = safeBuilder()
      .with(
        'threshold',
        faker.datatype.number({ min: messageConfirmations.length + 1 }),
      )
      .build();
    safeAppsRepositoryMock.getSafeAppById.mockResolvedValue(null);
    addressInfoHelperMock.getOrDefault.mockResolvedValue(addressInfo);

    const actual = await mapper.mapMessage(chainId, message, safe);

    expect(actual).toEqual(
      new Message(
        message.messageHash,
        MessageStatus.NeedsConfirmation,
        null,
        null,
        message.message,
        message.created.getTime(),
        message.modified.getTime(),
        messageConfirmations.length,
        safe.threshold,
        addressInfo,
        messageConfirmations.map(
          (messageConfirmation) =>
            new MessageConfirmation(addressInfo, messageConfirmation.signature),
        ),
        null,
      ),
    );
  });

  it('should return null name and logo if no safeAppId in the message', async () => {
    const chainId = faker.random.numeric();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const messageConfirmations = range(5).map(() =>
      messageConfirmationBuilder().build(),
    );
    const message = messageBuilder()
      .with('safeAppId', null)
      .with('confirmations', messageConfirmations)
      .build();
    const safe = safeBuilder()
      .with(
        'threshold',
        faker.datatype.number({ max: messageConfirmations.length }),
      )
      .build();
    addressInfoHelperMock.getOrDefault.mockResolvedValue(addressInfo);

    const actual = await mapper.mapMessage(chainId, message, safe);

    expect(actual).toEqual(
      new Message(
        message.messageHash,
        MessageStatus.Confirmed,
        null,
        null,
        message.message,
        message.created.getTime(),
        message.modified.getTime(),
        messageConfirmations.length,
        safe.threshold,
        addressInfo,
        messageConfirmations.map(
          (messageConfirmation) =>
            new MessageConfirmation(addressInfo, messageConfirmation.signature),
        ),
        message.preparedSignature,
      ),
    );
  });
});
