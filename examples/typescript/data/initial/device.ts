import { factory } from '../../model/factory';
import { Device, Android, Ios } from '../../model/model';
import { DATAID } from '../dataid';

export function registerInitialDevice() {
  const f = factory;
  f.register(DATAID.TEST01_DEVICE_1, () => {
    return {
      android: f.childNode(DATAID.TEST01_ANDROID_1) as Android,
      ios: f.childNode(DATAID.TEST01_IOS_1) as Ios,
    } as Device;
  });
  f.register(DATAID.TEST05_DEVICE_1, () => {
    return {} as Device;
  });
}
