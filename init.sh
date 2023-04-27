#!/bin/sh
set -eu

cd `dirname $0`

ln -s $(pwd)/tunnel.sh /usr/local/bin/tunnel
chmod 755 /usr/local/bin/tunnel
