#!/bin/bash

# build_backend.sh
# This script builds the Python backend into a single executable using PyInstaller.

echo "Building backend executable..."

# Navigate to the backend directory
pushd backend > /dev/null

# Activate virtual environment
source venv/bin/activate

# Build the executable
# --onefile: Create a single executable file
# --name: The name of the executable
# --distpath: The directory to place the final executable in
# --workpath: The directory for temporary build files
# --clean: Clean PyInstaller cache and remove temporary files before building
# --noconsole: Prevents the console window from appearing on Windows
pyinstaller main.py 
    --name sqlforge-backend 
    --onefile 
    --distpath ../frontend/resources/bin 
    --workpath build 
    --clean 
    --noconsole

BUILD_EXIT_CODE=$?

# Deactivate and return to the original directory
deactivate
popd > /dev/null

if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo "PyInstaller build failed with exit code $BUILD_EXIT_CODE."
  exit $BUILD_EXIT_CODE
fi

echo "Backend executable successfully built."
