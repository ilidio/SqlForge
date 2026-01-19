#!/bin/bash
# Script to completely remove SqlForge Docker artifacts (containers, volumes, images)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMPOSE_FILE="$DIR/../docker/docker-compose.yml"

echo "Cleaning up all SqlForge database Docker artifacts..."
docker compose -f "$COMPOSE_FILE" down -v --rmi all --remove-orphans 2>/dev/null || docker-compose -f "$COMPOSE_FILE" down -v --rmi all --remove-orphans

echo "Cleanup complete."
