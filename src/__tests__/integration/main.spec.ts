import { runCLI } from '../helpers';

describe('datatrait', () => {
  it('should display the help contents', () => {
    const { stdout } = runCLI(process.cwd(), ['--help']);

    expect(stdout).toContain('Usage: datatrait [options]');
  });
});
