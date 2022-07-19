import { factory } from '../../model/factory';
import { Android } from '../../model/model';
import { DATAID } from '../dataid';

export function registerInitialAndroid() {
  const f = factory;
  f.register(DATAID.TEST01_ANDROID_1, () => {
    return {
      manufacturer: 'google',
      model: 'pixel5',
    } as Android;
  });
}
