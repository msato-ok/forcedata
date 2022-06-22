export function zeropad(num: number, digit: number): string {
  let s = '0'.repeat(digit);
  s = `${s}${num}`;
  return s.substring(s.length - digit);
}

export function title(str: string): string {
  return str.substring(0, 1).toUpperCase() + str.substring(1);
}

export function camelCase(str: string, firstCharUpper = false): string {
  const s = str
    .split('_')
    .map(x => title(x))
    .join('');
  if (firstCharUpper) {
    return s;
  }
  return s.substring(0, 1).toLocaleLowerCase() + str.substring(1);
}

export function pascalCase(str: string): string {
  return camelCase(str, true);
}

export function isString(test: unknown): boolean {
  return typeof test === 'string';
}

export function isNumber(test: unknown): boolean {
  return typeof test === 'number';
}

export function isBoolean(test: unknown): boolean {
  return typeof test === 'boolean';
}

export function isObject(test: unknown): boolean {
  return typeof test === 'object';
}
