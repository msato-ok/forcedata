import { factory } from '../../model/factory';
import { Friends } from '../../model/model';
import { DATAID } from '../dataid';

export function registerInitialFriends() {
  const f = factory;
  f.register(DATAID.TEST01_FRIENDS_1, () => {
    return {
      id: 0,
      name: 'Colon Salazar',
    } as Friends;
  });
  f.register(DATAID.TEST01_FRIENDS_2, () => {
    return {
      id: 1,
      name: 'French\nMcneil',
    } as Friends;
  });
  f.register(DATAID.TEST02_FRIENDS_2, () => {
    const data = f.inheritNode(DATAID.TEST01_FRIENDS_2) as Friends;
    data.name = 'French\nMcneil2';
    return data;
  });
  f.register(DATAID.TEST04_FRIENDS_3, () => {
    return {
      id: 2,
      name: 'Nestor Salinas',
    } as Friends;
  });
}
