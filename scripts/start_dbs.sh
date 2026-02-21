#!/bin/bash

# Script to start SqlForge test databases
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MANAGE_SCRIPT="$DIR/../tests/scripts/manage_dbs.sh"

if [ -f "$MANAGE_SCRIPT" ]; then
  "$MANAGE_SCRIPT" start
else
  echo "Error: Management script not found at $MANAGE_SCRIPT"
  exit 1
fi
