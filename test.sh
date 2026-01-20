#!/bin/bash

# Ensure a clean environment
echo "--- Preparing Environment ---"
./scripts/stop_dbs.sh
./scripts/remove_local_dbs.sh --all
./scripts/start_dbs.sh

echo "Waiting for databases to initialize..."
sleep 5

echo ""
echo "--- Running Backend Tests ---"
cd backend
PYTHONPATH=. venv/bin/python -m pytest tests/
cd ..

echo ""
echo "--- Running Frontend Tests ---"
cd frontend
npm test
cd ..

echo ""
echo "--- Cleaning Up ---"
./scripts/stop_dbs.sh
./scripts/remove_local_dbs.sh

echo ""
echo "All tests completed and environment cleaned."
