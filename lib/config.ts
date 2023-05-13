import { StackProps } from "aws-cdk-lib";

export interface ConfigStackProps extends StackProps {
  config: StackInput;
}

export interface StackInput {
  stackEnv: StackEnv;
  appName: string;
  vpcConnectorProps: VpcConnectorProps;
  sourceConfigurationProps: SourceConfigurationProps;
  instanceConfigurationProps: InstanceConfigurationProps;
  autoScalingConfigurationArnProps: AutoScalingConfigurationArnProps;
}

export interface StackEnv {
  account: string;
  region: string;
}

export interface VpcConnectorProps {
  vpcID: string;
  subnetID1: string;
  subnetID2: string;
}

export interface SourceConfigurationProps {
  port: number;
}

export interface InstanceConfigurationProps {
  cpu: string;
  memory: string;
}

export interface AutoScalingConfigurationArnProps {
  maxConcurrency: number;
  maxSize: number;
  minSize: number;
}

export const stackInput: StackInput = {
  stackEnv: {
    // FIXME
    account: "123456789012", // Your AWS Account ID
    region: "ap-northeast-1",
  },
  appName: "BastionTunnel",
  vpcConnectorProps: {
    // FIXME
    vpcID: "vpc-1234abcd1234abcd00", // Your VPC ID
    subnetID1: "subnet-1234abcd1234abcd01", // Your Subnet ID
    subnetID2: "subnet-1234abcd1234abcd02", // Your Subnet ID
  },
  sourceConfigurationProps: {
    port: 8080,
  },
  instanceConfigurationProps: {
    cpu: "1 vCPU",
    memory: "2 GB",
  },
  autoScalingConfigurationArnProps: {
    maxConcurrency: 100,
    maxSize: 1,
    minSize: 1,
  },
};

export const configStackProps: ConfigStackProps = {
  env: {
    account: stackInput.stackEnv.account,
    region: stackInput.stackEnv.region,
  },
  config: stackInput,
};
