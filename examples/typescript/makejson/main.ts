/*
json のデータを作成するサンプル

usege:
npx ts-node examples/typescript/makejson/main.ts -v -o ./examples/json

*/
import { Command } from 'commander';
import { registerData, TestData } from '../data';
import { factory } from '../factory';
import path from 'path';
import fs from 'fs';

const packageJson = require('../../../package.json');
const version: string = packageJson.version;

interface IOption {
  verbose: boolean;
  output: string;
}

const program = new Command();
program.name('makejson').version(version);

program
  .description('generate json data')
  .requiredOption('-o, --output <dir>', 'output json dir')
  .option('-v, --verbose', 'verbose mode')
  .action((option: IOption): void => {
    executeCommand(option);
  });

program.parse(process.argv);

function executeCommand(option: IOption) {
  try {
    fs.mkdirSync(option.output, { recursive: true });

    registerData();
    for (const [jsonFile, dataId] of Object.entries(TestData)) {
      const outputPath = path.join(option.output, jsonFile);
      const data = factory.get(dataId);
      let text = JSON.stringify(data, replacer, '  ');
      text += '\n';

      console.log(`output ${outputPath} ...`);
      fs.writeFileSync(outputPath, text);
    }

    console.log('Done');
  } catch (e) {
    if (e instanceof Error) {
      if (option.verbose) {
        console.error(e.stack);
      } else {
        console.error(e.message);
      }
    } else {
      console.error(e);
    }
  }
}

function replacer(key: string, value: unknown | null): unknown | undefined {
  if (value === null) {
    return undefined;
  }
  return value;
}
