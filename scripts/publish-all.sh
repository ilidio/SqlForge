#!/bin/bash
echo "Building frontend..."
cd frontend
npm run build
cd ..

echo "Publishing complete. Frontend build is in frontend/dist."
