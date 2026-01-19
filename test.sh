#!/bin/bash
echo "Running backend tests..."
cd backend
source venv/bin/activate
PYTHONPATH=. pytest tests/
echo "Tests completed."
