import { registerInitialAndroid } from './initial/android';
import { registerInitialIos } from './initial/ios';
import { registerInitialHairStyle } from './initial/hair_style';
import { registerInitialFriends } from './initial/friends';
import { registerInitialDevice } from './initial/device';
import { registerInitialBase } from './initial/base';
import { DATAID } from './dataid';

// データ登録
export function registerData() {
  registerInitialAndroid();
  registerInitialIos();
  registerInitialHairStyle();
  registerInitialFriends();
  registerInitialDevice();
  registerInitialBase();
}

export const TestData = {
  'test01.json': DATAID.TEST01_BASE_1,
  'test02.json': DATAID.TEST02_BASE_1,
  'test03.json': DATAID.TEST03_BASE_1,
  'test04.json': DATAID.TEST04_BASE_1,
  'test05.json': DATAID.TEST05_BASE_1,
  'test06.json': DATAID.TEST06_BASE_1,
};
