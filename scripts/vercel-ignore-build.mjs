#!/usr/bin/env node

import {
  describeVercelBuildPolicy,
  vercelIgnoreCommandExitCode
} from "../lib/vercel-build-policy-v1.mjs";

const environment = process.env.VERCEL_ENV;
const policy = describeVercelBuildPolicy(environment);

console.log(`[scorecaster-vercel-build-policy] environment=${policy.environment} action=${policy.action}`);
process.exit(vercelIgnoreCommandExitCode(environment));
