import {
  AppRunnerClient,
  AutoScalingConfigurationSummary,
  CreateAutoScalingConfigurationCommand,
  DeleteAutoScalingConfigurationCommand,
  ListAutoScalingConfigurationsCommand,
  ListOperationsCommand,
  OperationStatus,
  UpdateServiceCommand,
} from "@aws-sdk/client-apprunner";
import { CloudFormationClient, DescribeStacksCommand, Output } from "@aws-sdk/client-cloudformation";
import { CdkCustomResourceHandler } from "aws-lambda";

interface InputProps {
  autoScalingConfigurationName: string;
  maxConcurrency: number;
  maxSize: number;
  minSize: number;
  stackName: string;
}

const appRunnerClient = new AppRunnerClient({
  region: process.env.REGION,
});

const cfnClient = new CloudFormationClient({
  region: process.env.REGION,
});

export const handler: CdkCustomResourceHandler = async function (event) {
  const data: { [key: string]: string } = {};
  const requestType = event.RequestType;
  const input: InputProps = {
    autoScalingConfigurationName: event.ResourceProperties[
      "AutoScalingConfigurationName"
    ] as string,
    maxConcurrency: Number(event.ResourceProperties["MaxConcurrency"] as string),
    maxSize: Number(event.ResourceProperties["MaxSize"] as string),
    minSize: Number(event.ResourceProperties["MinSize"] as string),
    stackName: event.ResourceProperties["StackName"] as string
  };

  if (requestType === "Create") {
    const autoScalingConfigurationArn = await createAutoScalingConfiguration(input);
    data["AutoScalingConfigurationArn"] = autoScalingConfigurationArn;
  } else if (requestType === "Update") {
    const autoScalingConfigurationList = await listAutoScalingConfiguration(input.autoScalingConfigurationName);

    if (autoScalingConfigurationList.length) {
      await changeAutoScalingConfigurationToDefault(input.stackName);
      await deleteAutoScalingConfiguration(autoScalingConfigurationList[0].AutoScalingConfigurationArn ?? "");
    }

    const autoScalingConfigurationArn = await createAutoScalingConfiguration(input);
    data["AutoScalingConfigurationArn"] = autoScalingConfigurationArn;
  } else if (requestType === "Delete") {
    const autoScalingConfigurationList = await listAutoScalingConfiguration(input.autoScalingConfigurationName);

    if (autoScalingConfigurationList.length) {
      await deleteAutoScalingConfiguration(autoScalingConfigurationList[0].AutoScalingConfigurationArn ?? "");
    }
  }

  return {
    PhysicalResourceId: "AutoScalingConfiguration",
    Data: data,
  };
};

const listAutoScalingConfiguration = async (autoScalingConfigurationName: string): Promise<AutoScalingConfigurationSummary[]> => {
  const listAutoScalingConfigurationCommand = new ListAutoScalingConfigurationsCommand({
    AutoScalingConfigurationName: autoScalingConfigurationName,
  });

  const listAutoScalingConfigurationsResponse = await appRunnerClient.send(
    listAutoScalingConfigurationCommand,
  );

  return listAutoScalingConfigurationsResponse.AutoScalingConfigurationSummaryList ?? [] as AutoScalingConfigurationSummary[]
}

const createAutoScalingConfiguration = async (input: InputProps): Promise<string> => {
  const createAutoScalingConfigurationCommand = new CreateAutoScalingConfigurationCommand({
    AutoScalingConfigurationName: input.autoScalingConfigurationName,
    MaxConcurrency: input.maxConcurrency,
    MaxSize: input.maxSize,
    MinSize: input.minSize,
  });

  const createAutoScalingConfigurationResponse = await appRunnerClient.send(
    createAutoScalingConfigurationCommand,
  );

  return createAutoScalingConfigurationResponse?.AutoScalingConfiguration
    ?.AutoScalingConfigurationArn ?? "";
}

const deleteAutoScalingConfiguration = async (autoScalingConfigurationArn: string): Promise<void> => {
  const deleteAutoScalingConfigurationCommand = new DeleteAutoScalingConfigurationCommand({
    AutoScalingConfigurationArn: autoScalingConfigurationArn,
  });

  await appRunnerClient.send(deleteAutoScalingConfigurationCommand);
}

const getServiceArn = async (stackName: string): Promise<string> => {
  const describeServiceCommand = new DescribeStacksCommand({
    StackName: stackName,
  });

  const stacks = await cfnClient.send(describeServiceCommand);

  const outputs = stacks.Stacks?.length && stacks.Stacks[0].Outputs ? stacks.Stacks[0].Outputs : [] as Output[];

  const output = outputs.find(
    (output) => output.ExportName === `${stackName}AppRunnerServiceArn`
  );

  return output?.OutputValue ?? "";
}

const waitOperation = async (operationId: string, serviceArn: string): Promise<void> => {
  if (operationId === "") throw new Error("OperationId is empty");

  while (true) {
    const listOperationsCommand = new ListOperationsCommand({
      ServiceArn: serviceArn,
    });

    const response = await appRunnerClient.send(listOperationsCommand);

    if (response.OperationSummaryList && response.OperationSummaryList.length) {
      const operationSummary = response.OperationSummaryList.find(operation => operation.Id === operationId)
      if (operationSummary?.Status !== OperationStatus.IN_PROGRESS && operationSummary?.Status !== OperationStatus.PENDING) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

const updateServiceForAutoScalingConfiguration = async (stackName: string, autoScalingConfigurationArn: string): Promise<void> => {
  const serviceArn = await getServiceArn(stackName);
  if (!serviceArn) throw new Error("Service Arn not found");

  const updateServiceCommand = new UpdateServiceCommand({
    ServiceArn: serviceArn,
    AutoScalingConfigurationArn: autoScalingConfigurationArn,
  });

  const response = await appRunnerClient.send(updateServiceCommand);

  await waitOperation(response.OperationId ?? "", serviceArn);
}

const changeAutoScalingConfigurationToDefault = async (stackName: string): Promise<void> => {
  const defaultAutoScalingConfigurationName = "DefaultConfiguration";
  const defaultAutoScalingConfiguration = await listAutoScalingConfiguration(defaultAutoScalingConfigurationName);

  if (defaultAutoScalingConfiguration.length) {
    const autoScalingConfigurationArn = defaultAutoScalingConfiguration[0].AutoScalingConfigurationArn ?? ""
    await updateServiceForAutoScalingConfiguration(stackName, autoScalingConfigurationArn);
  }
}