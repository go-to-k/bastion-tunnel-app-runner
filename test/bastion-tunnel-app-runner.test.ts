import { App, assertions } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ConfigStackProps, configStackProps } from "../lib/config";
import { BastionTunnelStack } from "../lib/resource/bastion-tunnel-app-runner-stack";

const getTemplate = (): assertions.Template => {
  const testConfigStackProps: ConfigStackProps = {
    env: {
      region: configStackProps.env?.region,
    },
    config: configStackProps.config,
  };

  const app = new App();
  const stack = new BastionTunnelStack(app, "BastionTunnelStack", testConfigStackProps);
  return Template.fromStack(stack);
};

describe("Snapshot Tests", () => {
  const template = getTemplate();

  test("Snapshot test", () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});

describe("Fine-grained Assertions Tests", () => {
  const template = getTemplate();

  test("Bucket created", () => {
    template.resourceCountIs("AWS::ECR::Repository", 1);
  });
  test("Bucket created", () => {
    template.resourceCountIs("AWS::SSM::Parameter", 1);
  });
  test("Bucket created", () => {
    template.resourceCountIs("AWS::AppRunner::VpcConnector", 1);
  });
  test("Bucket created", () => {
    template.resourceCountIs("AWS::AppRunner::Service", 1);
  });
});
