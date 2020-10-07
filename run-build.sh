#!/bin/bash

sleep 3
PARAM_1=$1
PARAM_2=$2
echo "abc"
echo "def"
echo "${PARAM_1}"
echo "${PARAM_2}"
echo "Download URL: https://zalo.me/pc"

read -rsp $'Press any key to continue...\n' -n1 key
