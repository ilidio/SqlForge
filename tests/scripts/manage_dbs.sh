#!/bin/bash

# Script to manage test databases for SqlForge

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMPOSE_FILE="$DIR/../docker/docker-compose.yml"

# Detect Docker Compose version
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "Error: Docker Compose is not installed. Please install Docker Desktop or the compose plugin."
  exit 1
fi

case "$1" in
  start)
    echo "Starting test databases using $DOCKER_COMPOSE..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d
    ;;
  stop)
    echo "Stopping test databases..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" down
    ;;
  logs)
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs -f
    ;;
  *)
    echo "Usage: $0 {start|stop|logs}"
    exit 1
esac
