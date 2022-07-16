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
  qualifications: unknown[];
}

// データの識別子
export const DATAID = {
  TEST01_ANDROID_1: 'TEST01_ANDROID_1',
  TEST01_IOS_1: 'TEST01_IOS_1',
  TEST01_HAIR_STYLE_1: 'TEST01_HAIR_STYLE_1',
  TEST01_FRIENDS_1: 'TEST01_FRIENDS_1',
  TEST01_FRIENDS_2: 'TEST01_FRIENDS_2',
  TEST01_DEVICE_1: 'TEST01_DEVICE_1',
  TEST01_BASE_1: 'TEST01_BASE_1',
  TEST02_FRIENDS_2: 'TEST02_FRIENDS_2',
  TEST02_BASE_1: 'TEST02_BASE_1',
  TEST03_BASE_1: 'TEST03_BASE_1',
  TEST04_FRIENDS_3: 'TEST04_FRIENDS_3',
  TEST04_BASE_1: 'TEST04_BASE_1',
  TEST05_DEVICE_1: 'TEST05_DEVICE_1',
  TEST05_BASE_1: 'TEST05_BASE_1',
  TEST06_BASE_1: 'TEST06_BASE_1',
} as const;
export type DATAID = typeof DATAID[keyof typeof DATAID];

// データ登録
export function registerData() {
  registerGroup1();
}

export function registerGroup1() {
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
    data.qualifications = [];
    return data;
  });
  f.register(DATAID.TEST03_BASE_1, () => {
    const data = f.inheritNode(DATAID.TEST02_BASE_1) as Base;
    data.qualifications = [];
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
    data.qualifications = [];
    return data;
  });
  f.register(DATAID.TEST05_DEVICE_1, () => {
    return {} as Device;
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

export const TestData = {
  'test01.json': DATAID.TEST01_BASE_1,
  'test02.json': DATAID.TEST02_BASE_1,
  'test03.json': DATAID.TEST03_BASE_1,
  'test04.json': DATAID.TEST04_BASE_1,
  'test05.json': DATAID.TEST05_BASE_1,
  'test06.json': DATAID.TEST06_BASE_1,
};
