#!/bin/bash
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
echo "All tests completed."
