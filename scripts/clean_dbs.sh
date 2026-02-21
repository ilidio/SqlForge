#!/bin/bash

# Script to completely remove SqlForge Docker artifacts (containers, volumes, images)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMPOSE_FILE="$DIR/../tests/docker/docker-compose.yml"

# Detect Docker Compose version
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "Error: Docker Compose is not installed."
  exit 1
fi

echo "Cleaning up all SqlForge database artifacts..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" down -v --rmi all --remove-orphans

echo "Cleanup complete."
