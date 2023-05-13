#!/bin/bash

set -eu

cd $(dirname $(readlink $0 || echo $0))

CUR_DIR=$(pwd)

LOCAL_DB_PORT="13306"
TARGET_DB_PORT="3306"
# FIXME: TARGET_HOST
TARGET_HOST="abcde.cluster-1234567890.ap-northeast-1.rds.amazonaws.com"

REGION="ap-northeast-1"
PROFILE=""
APP_NAME="Bastion"
SSM_PARAMETER_NAME="/ManagedInstanceIDParameter/${APP_NAME}"

TUNNEL_LOG_DIR_PATH="${CUR_DIR}/tunnel_logs"
TUNNEL_LOG_FILE_PATH="${TUNNEL_LOG_DIR_PATH}/$(date +%Y_%m%d_%H%M%S).log"

while getopts p:l:t:h:r: OPT; do
	case $OPT in
	p)
		PROFILE="$OPTARG"
		;;
	l)
		LOCAL_DB_PORT="$OPTARG"
		;;
	t)
		TARGET_DB_PORT="$OPTARG"
		;;
	h)
		TARGET_HOST="$OPTARG"
		;;
	r)
		REGION="$OPTARG"
		;;
	esac
done

if [ -z ${LOCAL_DB_PORT} ] || [ -z ${TARGET_DB_PORT} ] || [ -z ${TARGET_HOST} ] || [ -z ${REGION} ]; then
	echo "ex) tunnel [-p profile] [-l 13306] [-t 3306] [-h host] [-r ap-northeast-1]"
	echo "-p : AWSプロファイル(デフォルト : 空)"
	echo "-l : ローカルポート(デフォルト : 13306)"
	echo "-t : ターゲットポート(リモートポート)(デフォルト : 3306)"
	echo "-h : ターゲットホスト(デフォルト : abcde.cluster-1234567890.ap-northeast-1.rds.amazonaws.com)"
	echo "-r : App Runnerを構築したAWSリージョン(デフォルト : ap-northeast-1)"
	exit 0
fi

profileOption=""

if [ -n "${PROFILE}" ]; then
	profileOption="--profile ${PROFILE}"
fi

target=$(
	aws ssm get-parameters \
		--name "${SSM_PARAMETER_NAME}" \
		${profileOption} |
		jq -r .Parameters[0].Value
)

parameters="{\"host\":[\"${TARGET_HOST}\"],\"portNumber\":[\"${TARGET_DB_PORT}\"], \"localPortNumber\":[\"${LOCAL_DB_PORT}\"]}"

mkdir -p ${TUNNEL_LOG_DIR_PATH}
touch ${TUNNEL_LOG_FILE_PATH}

echo "300分経つと接続が切れます。"

aws ssm start-session \
	--target ${target} \
	--document-name AWS-StartPortForwardingSessionToRemoteHost \
	--parameters "${parameters}" \
	--region ${REGION} \
	${profileOption} >${TUNNEL_LOG_FILE_PATH} &

# 1日経ったログは消す
find ${TUNNEL_LOG_DIR_PATH} -type f -mtime +1 | xargs rm
