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

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HairStyle {}

export interface Friends {
  id: number;
  name: string;
}

export interface Device {
  android: Android;
  ios: Ios;
}

export interface Android {
  manufacturer: string;
  model: string;
}

export interface Ios {
  manufacturer: string;
  model: string;
}
