import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ConfigStackProps } from "../config";
import { SSMConstruct } from "../construct/ssm";
import { AppRunnerConstruct } from "../construct/app-runner";

export class BastionTunnelStack extends Stack {
  constructor(scope: Construct, id: string, props: ConfigStackProps) {
    super(scope, id, props);

    new SSMConstruct(this, "SSMConstruct", props);
    new AppRunnerConstruct(this, "AppRunnerConstruct", props);
  }
}
