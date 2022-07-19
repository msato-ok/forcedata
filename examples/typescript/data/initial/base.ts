import { factory } from '../../model/factory';
import { Base, HairStyle, Friends, Device } from '../../model/model';
import { DATAID } from '../dataid';

export function registerInitialBase() {
  const f = factory;
  f.register(DATAID.TEST01_BASE_1, () => {
    return {
      id: '5973782bdb9a930533b05cb2',
      is_active: true,
      age: 32,
      name: 'Logan Keller',
      gender: 'male',
      eye_color: null,
      hair_style: f.childNode(DATAID.TEST01_HAIR_STYLE_1) as HairStyle,
      salery: 9007199254740991,
      friends: [f.childNode(DATAID.TEST01_FRIENDS_1) as Friends, f.childNode(DATAID.TEST01_FRIENDS_2) as Friends],
      groups: [1, 2, 3],
      rooms: ['1-1', '1-2'],
      device: f.childNode(DATAID.TEST01_DEVICE_1) as Device,
    } as Base;
  });
  f.register(DATAID.TEST02_BASE_1, () => {
    const data = f.inheritNode(DATAID.TEST01_BASE_1) as Base;
    data.is_active = false;
    data.friends[1] = f.childNode(DATAID.TEST02_FRIENDS_2) as Friends;
    data.groups = [1, 2, 3, 4];
    data.qualifications = [];
    return data;
  });
  f.register(DATAID.TEST03_BASE_1, () => {
    const data = f.inheritNode(DATAID.TEST02_BASE_1) as Base;
    data.qualifications = [];
    return data;
  });
  f.register(DATAID.TEST04_BASE_1, () => {
    const data = f.inheritNode(DATAID.TEST01_BASE_1) as Base;
    data.friends = [
      f.childNode(DATAID.TEST01_FRIENDS_1) as Friends,
      f.childNode(DATAID.TEST01_FRIENDS_2) as Friends,
      f.childNode(DATAID.TEST04_FRIENDS_3) as Friends,
    ];
    data.qualifications = [];
    return data;
  });
  f.register(DATAID.TEST05_BASE_1, () => {
    return {
      id: '05',
      device: f.childNode(DATAID.TEST05_DEVICE_1) as Device,
    } as Base;
  });
  f.register(DATAID.TEST06_BASE_1, () => {
    return {
      id: '06',
      qualifications: [] as unknown[],
    } as Base;
  });
}
