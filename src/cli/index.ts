#!/usr/bin/env node

import { Command } from 'commander';
import { importCommand } from './commands/import.js';
import { runCommand } from './commands/run.js';
import { reportCommand } from './commands/report.js';

const program = new Command();

program
  .name('omni-qa')
  .description('omni-qa - Universal API automation testing platform')
  .version('1.0.0');

program.addCommand(importCommand);
program.addCommand(runCommand);
program.addCommand(reportCommand);

program.parse();
