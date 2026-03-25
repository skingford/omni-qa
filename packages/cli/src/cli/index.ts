#!/usr/bin/env bun

import { Command } from 'commander';
import { configCommand } from './commands/config.js';
import { initCommand } from './commands/init.js';
import { importCommand } from './commands/import.js';
import { runCommand } from './commands/run.js';
import { reportCommand } from './commands/report.js';

const program = new Command();
const argv = process.argv[2] === '--'
  ? [process.argv[0], process.argv[1], ...process.argv.slice(3)]
  : process.argv;

program
  .name('omni-qa')
  .description('omni-qa - Universal API automation testing platform')
  .version('1.0.0');

program.addCommand(configCommand);
program.addCommand(initCommand);
program.addCommand(importCommand);
program.addCommand(runCommand);
program.addCommand(reportCommand);

if (argv.length <= 2) {
  program.help();
}

program.parse(argv);
