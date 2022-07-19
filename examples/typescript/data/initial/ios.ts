import { factory } from '../../model/factory';
import { Ios } from '../../model/model';
import { DATAID } from '../dataid';

export function registerInitialIos() {
  const f = factory;
  f.register(DATAID.TEST01_IOS_1, () => {
    return {
      manufacturer: 'apple',
      model: 'iphone12',
    } as Ios;
  });
}
