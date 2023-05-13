#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { BastionTunnelStack } from "../lib/resource/bastion-tunnel-app-runner-stack";
import { configStackProps } from "../lib/config";
import { deploySSMRunShell } from "../lib/resource/ssm-run-shell";

const app = new App();

new BastionTunnelStack(app, "BastionTunnelStack", configStackProps);

(async () => {
    await deploySSMRunShell(configStackProps.config.stackEnv.account);
})();