import { factory } from '../../model/factory';
import { HairStyle } from '../../model/model';
import { DATAID } from '../dataid';

export function registerInitialHairStyle() {
  const f = factory;
  f.register(DATAID.TEST01_HAIR_STYLE_1, () => {
    return {} as HairStyle;
  });
}
