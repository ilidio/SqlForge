#!/bin/bash
cd backend
source venv/bin/activate
# Using PYTHONPATH=. ensures local modules like 'models' and 'database' are found
PYTHONPATH=. uvicorn main:app --reload --port 8000
