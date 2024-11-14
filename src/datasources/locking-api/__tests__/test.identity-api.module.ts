import { IIdentityApi } from '@/domain/interfaces/identity-api.interface';
import { Module } from '@nestjs/common';

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
