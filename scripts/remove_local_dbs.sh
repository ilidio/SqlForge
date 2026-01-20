#!/bin/bash
# Script to remove local SQLite database files (excluding metadata by default)

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$DIR/../backend"
METADATA_DB="sqlforge_metadata.db"

DELETE_ALL=false
if [ "$1" == "--all" ]; then
    DELETE_ALL=true
fi

echo "Cleaning up local SQLite databases..."

if [ "$DELETE_ALL" = true ]; then
    echo "Full wipe requested (including metadata)..."
    rm -f "$BACKEND_DIR"/*.db
    rm -f "$BACKEND_DIR"/*.db-journal
else
    echo "Removing data databases (preserving $METADATA_DB)..."
    # Find all .db files, exclude the metadata one
    find "$BACKEND_DIR" -maxdepth 1 -name "*.db" ! -name "$METADATA_DB" -delete
    find "$BACKEND_DIR" -maxdepth 1 -name "*.db-journal" ! -name "$METADATA_DB-journal" -delete
fi

echo "Cleanup complete."