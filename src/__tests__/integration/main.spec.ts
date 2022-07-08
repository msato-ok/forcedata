import { runCLI } from '../helpers';

describe('forcedata', () => {
  it('should display the help contents', () => {
    const { stdout } = runCLI(process.cwd(), ['--help']);

    expect(stdout).toContain('Usage: forcedata [options]');
  });
});
