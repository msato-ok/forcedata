import { factory } from './factory';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HairStyle {}

export interface Friends {
  id: number;
  name: string;
}

export interface Android {
  manufacturer: string;
  model: string;
}

export interface Ios {
  manufacturer: string;
  model: string;
}

export interface Device {
  android: Android;
  ios: Ios;
}

export interface Base {
  id: string;
  is_active: boolean;
  age: number;
  name: string;
  gender: string;
  eye_color: unknown;
  hair_style: HairStyle;
  salery: number;
  friends: Friends[];
  groups: number[];
  rooms: string[];
  device: Device;
}

// データの識別子
export type MyDataId =
  | 'TEST01_ANDROID_1'
  | 'TEST01_IOS_1'
  | 'TEST01_HAIR_STYLE_1'
  | 'TEST01_FRIENDS_1'
  | 'TEST01_FRIENDS_2'
  | 'TEST01_DEVICE_1'
  | 'TEST01_BASE_1'
  | 'TEST02_FRIENDS_2'
  | 'TEST02_BASE_1'
  | 'TEST04_FRIENDS_3'
  | 'TEST04_BASE_1';
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DATAID {
  export const TEST01_ANDROID_1: MyDataId = 'TEST01_ANDROID_1';
  export const TEST01_IOS_1: MyDataId = 'TEST01_IOS_1';
  export const TEST01_HAIR_STYLE_1: MyDataId = 'TEST01_HAIR_STYLE_1';
  export const TEST01_FRIENDS_1: MyDataId = 'TEST01_FRIENDS_1';
  export const TEST01_FRIENDS_2: MyDataId = 'TEST01_FRIENDS_2';
  export const TEST01_DEVICE_1: MyDataId = 'TEST01_DEVICE_1';
  export const TEST01_BASE_1: MyDataId = 'TEST01_BASE_1';
  export const TEST02_FRIENDS_2: MyDataId = 'TEST02_FRIENDS_2';
  export const TEST02_BASE_1: MyDataId = 'TEST02_BASE_1';
  export const TEST04_FRIENDS_3: MyDataId = 'TEST04_FRIENDS_3';
  export const TEST04_BASE_1: MyDataId = 'TEST04_BASE_1';
}

// データ登録
export function registerData() {
  const f = factory;
  f.register(DATAID.TEST01_ANDROID_1, () => {
    return {
      manufacturer: 'google',
      model: 'pixel5',
    } as Android;
  });
  f.register(DATAID.TEST01_IOS_1, () => {
    return {
      manufacturer: 'apple',
      model: 'iphone12',
    } as Ios;
  });
  f.register(DATAID.TEST01_HAIR_STYLE_1, () => {
    return {} as HairStyle;
  });
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
  f.register(DATAID.TEST01_DEVICE_1, () => {
    return {
      android: f.childNode(DATAID.TEST01_ANDROID_1) as Android,
      ios: f.childNode(DATAID.TEST01_IOS_1) as Ios,
    } as Device;
  });
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
  f.register(DATAID.TEST02_FRIENDS_2, () => {
    const data = f.inheritNode(DATAID.TEST01_FRIENDS_2) as Friends;
    data.name = 'French\nMcneil2';
    return data;
  });
  f.register(DATAID.TEST02_BASE_1, () => {
    const data = f.inheritNode(DATAID.TEST01_BASE_1) as Base;
    data.is_active = false;
    data.friends[1] = f.childNode(DATAID.TEST02_FRIENDS_2) as Friends;
    data.groups = [1, 2, 3, 4];
    return data;
  });
  f.register(DATAID.TEST04_FRIENDS_3, () => {
    return {
      id: 2,
      name: 'Nestor Salinas',
    } as Friends;
  });
  f.register(DATAID.TEST04_BASE_1, () => {
    const data = f.inheritNode(DATAID.TEST01_BASE_1) as Base;
    data.friends = [
      f.childNode(DATAID.TEST01_FRIENDS_1) as Friends,
      f.childNode(DATAID.TEST01_FRIENDS_2) as Friends,
      f.childNode(DATAID.TEST04_FRIENDS_3) as Friends,
    ];
    return data;
  });
}

export const TestData = {
  'test01.json': DATAID.TEST01_BASE_1,
  'test02.json': DATAID.TEST02_BASE_1,
  'test04.json': DATAID.TEST04_BASE_1,
};
