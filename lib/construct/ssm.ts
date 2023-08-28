import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { ConfigStackProps, StackInput } from "../config";

export class SSMConstruct extends Construct {
  private stackInput: StackInput;

  constructor(scope: Construct, id: string, props: ConfigStackProps) {
    super(scope, id);

    this.stackInput = props.config;

    /* 
      SSM Parameter Store for Managed Instance ID
    */
    new StringParameter(this, "ManagedInstanceIDParameter", {
      parameterName: `/ManagedInstanceIDParameter/${this.stackInput.appName}`,
      stringValue: "ManagedInstanceIDParameter",
      description: "Managed Instance ID Parameter",
    });

    /* 
      SSM Service Role for container
    */
    const ssmServiceRole = new Role(this, "SSMServiceRole", {
      roleName: `${this.stackInput.appName}-SSMServiceRole`,
      assumedBy: new ServicePrincipal("ssm.amazonaws.com"),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
    });

    ssmServiceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ssm:DeregisterManagedInstance"],
        resources: ["*"],
      }),
    );
  }
}
