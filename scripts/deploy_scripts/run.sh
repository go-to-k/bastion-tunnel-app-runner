#!/bin/bash
set -e

SSM_SERVICE_ROLE_NAME="${APP_NAME}-SSMServiceRole"
SSM_PARAMETER_NAME="/ManagedInstanceIDParameter/${APP_NAME}"
AWS_REGION="ap-northeast-1"
REGISTRATION_FILE="/var/lib/amazon/ssm/registration"

### App Runnerでシグナルトラップできない？(発火しなかった)
cleanup() {
	# コンテナ終了時、マネージドインスタンス登録を解除
	echo "Deregister a managed instance..."
	aws ssm deregister-managed-instance --instance-id "$(cat "${REGISTRATION_FILE}" | jq -r .ManagedInstanceID)" || true
	exit 0
}

# エラー対処
amazon-ssm-agent stop
rm -rf /var/lib/amazon/ssm/ipc

ACTIVATION_PARAMETERS=$(aws ssm create-activation \
	--description "Activation Code for App Runner Bastion" \
	--default-instance-name apprunnerbastion \
	--iam-role ${SSM_SERVICE_ROLE_NAME} \
	--registration-limit 1 \
	--tags Key=Type,Value=AppRunnerBastion \
	--region ${AWS_REGION})

SSM_ACTIVATION_ID=$(echo ${ACTIVATION_PARAMETERS} | jq -r .ActivationId)
SSM_ACTIVATION_CODE=$(echo ${ACTIVATION_PARAMETERS} | jq -r .ActivationCode)

result=$(amazon-ssm-agent -register -code "${SSM_ACTIVATION_CODE}" -id "${SSM_ACTIVATION_ID}" -region ${AWS_REGION})

trap "cleanup" EXIT ERR

echo "${result}"

MANAGED_INSTANCE_ID=$(echo ${result} | grep -Eo "instance-id: .*$" | grep -Eo "[^ ]*$")
echo "Managed instance-id: ${MANAGED_INSTANCE_ID}"

aws ssm put-parameter --name "${SSM_PARAMETER_NAME}" --value "${MANAGED_INSTANCE_ID}" --type String --overwrite

aws ssm delete-activation --activation-id ${SSM_ACTIVATION_ID}

### TCPヘルスチェックの場合
# nc -l -p ${PORT} &

### HTTPヘルスチェックの場合
function hello() {
	while true; do (
		echo "HTTP/1.1 200 Ok"
		echo
		echo "OK"
	) | nc -l -p ${PORT}; done
}
hello &

amazon-ssm-agent
