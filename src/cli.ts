import { Command } from 'commander';
import { JsonCommand, ICommandOption } from './cmd/base';
import { JsonToGoCommand } from './cmd/json2go';
import { JsonToTypeCommand } from './cmd/json2type';

const packageJson = require('../package.json');
const version: string = packageJson.version;

const program = new Command();

program.name('datatrait').version(version);

program
  .command('json2type <pattern>')
  .description('generate type definition yaml from json')
  .requiredOption('-o, --output <file>', 'output source file')
  .option('-m, --model', 'root model name')
  .option('-v, --verbose', 'verbose mode')
  .action((pattern: string, option: ICommandOption): void => {
    const command = new JsonToTypeCommand(option);
    executeCommand(pattern, command);
  });

program
  .command('json2go <pattern>')
  .description('generate golang source code from json')
  .requiredOption('-o, --output <file>', 'output source file')
  .option('-t, --type', 'type definition yaml')
  .option('-m, --model', 'root model name')
  .option('-v, --verbose', 'verbose mode')
  .action((pattern: string, option: ICommandOption): void => {
    const command = new JsonToGoCommand(option);
    executeCommand(pattern, command);
  });

program.parse(process.argv);

function executeCommand(pattern: string, command: JsonCommand) {
  try {
    command.execute(pattern);
  } catch (e) {
    if (e instanceof Error) {
      if (command.option.verbose) {
        console.error(e.stack);
      } else {
        console.error(e.message);
      }
    } else {
      console.error(e);
    }
  }
}
