import { Module } from '@nestjs/common';
import { IIdentityApi } from '@/domain/interfaces/identity-api.interface';

@Module({
  providers: [
    {
      provide: IIdentityApi,
      useFactory: (): jest.MockedObjectDeep<IIdentityApi> =>
        jest.mocked({
          checkEligibility: jest.fn(),
        }),
    },
  ],
  exports: [IIdentityApi],
})
export class TestIdentityApiModule {}
