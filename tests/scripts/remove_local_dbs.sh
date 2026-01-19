#!/bin/bash
# Script to remove local SQLite database files
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$DIR/../../backend"

echo "Removing local SQLite databases..."
rm -f "$BACKEND_DIR"/*.db
rm -f "$BACKEND_DIR"/*.db-journal

echo "Local databases removed."
