/*
力指向グラフの html を作成するサンプル

usege:
npx ts-node examples/typescript/force/main.ts -v -o ./examples/force-data.js

*/
import { Command } from 'commander';
import { registerData } from '../data/data';
import { factory } from '../model/factory';
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
  .description('generate force-directed graph')
  .requiredOption('-o, --output <path>', 'output html file path')
  .option('-v, --verbose', 'verbose mode')
  .action((option: IOption): void => {
    executeCommand(option);
  });

program.parse(process.argv);

function executeCommand(option: IOption) {
  try {
    const dir = path.dirname(option.output);
    fs.mkdirSync(dir, { recursive: true });

    registerData();
    const nodeList = factory.nodeList();
    const text = 'var forceData = ' + JSON.stringify(nodeList, null, '  ') + ';\n';
    fs.writeFileSync(option.output, text);

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
