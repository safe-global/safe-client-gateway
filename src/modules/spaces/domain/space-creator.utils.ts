// SPDX-License-Identifier: FSL-1.1-MIT
import type { User } from '#/modules/users/domain/entities/user.entity';
import type { IUsersRepository } from '#/modules/users/domain/users.repository.interface';

/**
 * Readies the user who is about to create a Workspace: they must exist, and
 * creating one activates a pending account.
 */
export async function activateSpaceCreator(
  usersRepository: IUsersRepository,
  userId: User['id'],
): Promise<void> {
  await usersRepository.findOneOrFail({ id: userId });
  await usersRepository.activateIfPending(userId);
}
