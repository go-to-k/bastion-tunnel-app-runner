#!/bin/bash

set -eu

cd $(dirname $0) && cd ../

DEPLOYMODE="on"
PROFILE=""

while getopts p:d: OPT; do
	case $OPT in
	p)
		PROFILE="$OPTARG"
		;;
	d)
		DEPLOYMODE="$OPTARG"
		;;
	esac
done

if [ "${DEPLOYMODE}" != "on" -a "${DEPLOYMODE}" != "off" ]; then
	echo "required DEPLOYMODE"
	echo "[-p (profile)](option): aws profile name"
	echo "[-d on|off](option): deploy mode (off=change set mode)"
	exit 0
fi

PROFILE_OPTION=""

if [ -n "${PROFILE}" ]; then
	PROFILE_OPTION="-p ${PROFILE}"
fi

bash ./deploy_scripts/scripts/01_deploy_apprunner.sh ${PROFILE_OPTION} -d ${DEPLOYMODE}
bash ./deploy_scripts/scripts/02_build.sh ${PROFILE_OPTION}
