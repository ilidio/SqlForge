#!/bin/bash
echo "Setting up backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

echo "Setting up frontend..."
cd frontend
npm install
cd ..

echo "Setup complete. Use 'backend/venv/bin/uvicorn backend.main:app --reload' to start backend and 'cd frontend && npm run dev' to start frontend."
