import {
  Cpu,
  Memory,
  Service,
  Source,
  VpcConnector,
} from "@aws-cdk/aws-apprunner-alpha";
import { CustomResource, RemovalPolicy, Stack } from "aws-cdk-lib";
import { CfnService } from "aws-cdk-lib/aws-apprunner";
import { SecurityGroup, Vpc, Subnet } from "aws-cdk-lib/aws-ec2";
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { ConfigStackProps, StackInput } from "../config";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import { SSMConstruct } from "../construct/ssm";
import { AppRunnerConstruct } from "../construct/app-runner";

export class BastionTunnelStack extends Stack {
  constructor(scope: Construct, id: string, props: ConfigStackProps) {
    super(scope, id, props);

    new SSMConstruct(this, "SSMConstruct", props);
    new AppRunnerConstruct(this, "AppRunnerConstruct", props)
  }
}