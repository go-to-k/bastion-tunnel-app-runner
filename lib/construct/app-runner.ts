import { CfnOutput, CustomResource, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Provider } from "aws-cdk-lib/custom-resources";
import { DockerImageName, ECRDeployment } from "cdk-ecr-deployment";
import { Construct } from "constructs";
import { resolve } from "path";
import { ConfigStackProps, StackInput } from "../config";
import { Cpu, Memory, Service, Source, VpcConnector } from "@aws-cdk/aws-apprunner-alpha";
import { SecurityGroup, Subnet, Vpc } from "aws-cdk-lib/aws-ec2";
import { CfnService } from "aws-cdk-lib/aws-apprunner";

export class AppRunnerConstruct extends Construct {
    private stackInput: StackInput;

    constructor(scope: Construct, id: string, props: ConfigStackProps) {
        super(scope, id);

        this.stackInput = props.config;

        /*
          ECR
         */
        const repository = new Repository(this, "ImageRepository", {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteImages: true,
        });

        repository.addLifecycleRule({
            rulePriority: 1,
            maxImageCount: 3,
        });

        const image = new DockerImageAsset(this, "AppRunnerImage", {
            directory: resolve(__dirname, "../.."),
            platform: Platform.LINUX_AMD64,
        });

        new ECRDeployment(this, "DeployImage", {
            src: new DockerImageName(image.imageUri),
            dest: new DockerImageName(
                `${repository.repositoryUri}:latest`,
            ),
        });

        /*
          Custom Resource Lambda for creation of AutoScalingConfiguration
        */
        const customResourceLambda = new NodejsFunction(this, "CustomResourceLambda", {
            runtime: Runtime.NODEJS_18_X,
            entry: resolve(__dirname, "../auto-scaling-configuration.ts"),
            handler: "handler",
            bundling: {
                forceDockerBundling: false,
            },
            timeout: Duration.seconds(900),
            initialPolicy: [
                new PolicyStatement({
                    actions: ["apprunner:*AutoScalingConfiguration*"],
                    resources: ["*"],
                }),
                new PolicyStatement({
                    actions: ["apprunner:UpdateService"],
                    resources: ["*"],
                }),
                new PolicyStatement({
                    actions: ["apprunner:ListOperations"],
                    resources: ["*"],
                }),
                new PolicyStatement({
                    actions: ["cloudformation:DescribeStacks"],
                    resources: [Stack.of(this).stackId],
                }),
            ],
        });

        /*
          AutoScalingConfiguration
        */
        const autoScalingConfigurationProvider = new Provider(
            this,
            "AutoScalingConfigurationProvider",
            {
                onEventHandler: customResourceLambda,
            },
        );

        const autoScalingConfigurationProperties: { [key: string]: string } = {};
        autoScalingConfigurationProperties["AutoScalingConfigurationName"] = this.stackInput.appName;
        autoScalingConfigurationProperties["MaxConcurrency"] = String(
            this.stackInput.autoScalingConfigurationArnProps.maxConcurrency,
        );
        autoScalingConfigurationProperties["MaxSize"] = String(
            this.stackInput.autoScalingConfigurationArnProps.maxSize,
        );
        autoScalingConfigurationProperties["MinSize"] = String(
            this.stackInput.autoScalingConfigurationArnProps.minSize,
        );
        autoScalingConfigurationProperties["StackName"] = Stack.of(this).stackName;

        const autoScalingConfiguration = new CustomResource(this, "AutoScalingConfiguration", {
            resourceType: "Custom::AutoScalingConfiguration",
            properties: autoScalingConfigurationProperties,
            serviceToken: autoScalingConfigurationProvider.serviceToken,
        });
        const autoScalingConfigurationArn = autoScalingConfiguration.getAttString(
            "AutoScalingConfigurationArn",
        );

        /*
          AccessRole for AppRunner Service
        */
        const appRunnerAccessRole = new Role(this, "AppRunnerAccessRole", {
            assumedBy: new ServicePrincipal("build.apprunner.amazonaws.com"),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSAppRunnerServicePolicyForECRAccess"),
            ],
        });

        /*
          InstanceRole for AppRunner Service
        */
        const appRunnerInstanceRole = new Role(this, "AppRunnerInstanceRole", {
            assumedBy: new ServicePrincipal("tasks.apprunner.amazonaws.com"),
        });

        appRunnerInstanceRole.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "ssm:DeleteActivation",
                "ssm:RemoveTagsFromResource",
                "ssm:AddTagsToResource",
                "ssm:CreateActivation",
                "ssm:DeregisterManagedInstance",
            ],
            resources: ["*"],
        }));

        appRunnerInstanceRole.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "ssm:PutParameter",
                "ssm:GetParameter*",
                "ssm:DescribeParameters",
            ],
            resources: ["*"],
        }));

        appRunnerInstanceRole.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "iam:PassRole",
            ],
            resources: ["*"],
            conditions: {
                "StringEquals": {
                    "iam:PassedToService": "ssm.amazonaws.com",
                },
            }
        }));


        /*
          L2 Construct(alpha version) for VPC Connector
        */
        const vpc = Vpc.fromLookup(this, "VPCForSecurityGroupForVpcConnector", {
            vpcId: this.stackInput.vpcConnectorProps.vpcID,
        });

        const securityGroupForVpcConnector = new SecurityGroup(
            this,
            "SecurityGroupForVpcConnector",
            {
                vpc: vpc,
                description: "for AppRunner VPC Connector",
            },
        );

        const vpcConnector = new VpcConnector(this, "VpcConnector", {
            vpc: vpc,
            securityGroups: [securityGroupForVpcConnector],
            vpcSubnets: {
                subnets: [
                    Subnet.fromSubnetId(this, "Subnet1", this.stackInput.vpcConnectorProps.subnetID1),
                    Subnet.fromSubnetId(this, "Subnet2", this.stackInput.vpcConnectorProps.subnetID2),
                ],
            },
        });

        /*
          L2 Construct(alpha version) for AppRunner Service
        */
        const appRunnerService = new Service(this, "AppRunnerService", {
            accessRole: appRunnerAccessRole,
            instanceRole: appRunnerInstanceRole,
            source: Source.fromEcr({
                imageConfiguration: {
                    environment: {
                        ["APP_NAME"]: this.stackInput.appName,
                        ["PORT"]: String(this.stackInput.sourceConfigurationProps.port),
                    },
                    port: this.stackInput.sourceConfigurationProps.port,
                },
                repository: repository,
            }),
            cpu: Cpu.of(this.stackInput.instanceConfigurationProps.cpu),
            memory: Memory.of(this.stackInput.instanceConfigurationProps.memory),
            vpcConnector: vpcConnector,
        });

        const cfnAppRunner = appRunnerService.node.defaultChild as CfnService;
        cfnAppRunner.autoScalingConfigurationArn = autoScalingConfigurationArn;
        cfnAppRunner.healthCheckConfiguration = {
            path: "/",
            protocol: "HTTP",
        };
        cfnAppRunner.addPropertyOverride("SourceConfiguration.AutoDeploymentsEnabled", true);

        new CfnOutput(this, 'AppRunnerServiceArn', {
            value: appRunnerService.serviceArn,
            exportName: `${Stack.of(this).stackName}AppRunnerServiceArn`,
        });
    }
}