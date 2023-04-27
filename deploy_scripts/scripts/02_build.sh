#!/bin/bash

set -eu

cd $(dirname $0) && cd ../../

trap 'echo Error Occurred!!! Exit...' ERR

PROFILE=""
APPNAME="Bastion"
REGION="ap-northeast-1"

while getopts p: OPT; do
	case $OPT in
	p)
		PROFILE="$OPTARG"
		;;
	esac
done

function build {
	local profileOption=""

	if [ -n "${1:-}" ]; then
		profileOption="--profile ${1}"
	fi

	#### docker build & push
	local repositoryName=$(echo "${APPNAME}-ECR" | tr '[:upper:]' '[:lower:]')
	local accountId=$(aws sts get-caller-identity --query "Account" --output text ${profileOption})
	local repositoryEnddpoint="${accountId}.dkr.ecr.ap-northeast-1.amazonaws.com"
	local ecrTag="latest"
	local repositoryUri="${repositoryEnddpoint}/${repositoryName}:${ecrTag}"

	docker build \
		--platform=amd64 \
		-t ${repositoryUri} \
		.

	aws ecr get-login-password --region ${REGION} ${profileOption} |
		docker login --username AWS --password-stdin ${repositoryEnddpoint}

	docker push ${repositoryUri}
}

build "${PROFILE:-}"
