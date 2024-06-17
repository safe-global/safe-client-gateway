import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountsRepository implements IAccountsRepository {}
