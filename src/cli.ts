#!/usr/bin/env node
import {runLocalCli} from "./cli/local/run-local-cli.js";

void runLocalCli({
  reconfigure: process.argv.includes("--reconfigure"),
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Pixelle CLI failed.");
  process.exitCode = 1;
});
