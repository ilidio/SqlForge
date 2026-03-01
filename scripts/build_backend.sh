#!/bin/bash

# build_backend.sh
# This script builds the Python backend into a single executable using PyInstaller.

# TARGET_OS can be passed as the first argument (optional)
TARGET_OS=$1

echo "Building backend executable for target: ${TARGET_OS:-host}..."

# Navigate to the SqlForge-Backend directory
pushd SqlForge-Backend > /dev/null

# Activate virtual environment
if [ -d "venv" ]; then
  source venv/bin/activate
elif [ -d ".venv" ]; then
  source .venv/bin/activate
fi

# Build the executable
# --onefile: Create a single executable file
# --name: The name of the executable
# --distpath: The directory to place the final executable in
# --workpath: The directory for temporary build files
# --clean: Clean PyInstaller cache and remove temporary files before building
# --noconsole: Prevents the console window from appearing on Windows
pyinstaller main.py \
    --name sqlforge-backend \
    --onefile \
    --distpath ../SqlForge/resources/bin \
    --workpath build \
    --clean \
    --noconsole

BUILD_EXIT_CODE=$?

# If we are cross-compiling or building for Windows from macOS,
# rename the output to .exe so the installer can find it.
# Note: This file won't RUN on Windows if built on macOS, but it will be "found" by the installer.
if [ "$TARGET_OS" == "win" ]; then
  if [ -f "../SqlForge/resources/bin/sqlforge-backend" ]; then
    echo "Renaming backend to sqlforge-backend.exe for Windows installer..."
    mv "../SqlForge/resources/bin/sqlforge-backend" "../SqlForge/resources/bin/sqlforge-backend.exe"
  fi
fi

# Deactivate and return to the original directory
if [ "$(type -t deactivate)" = "function" ]; then
  deactivate
fi
popd > /dev/null

if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo "PyInstaller build failed with exit code $BUILD_EXIT_CODE."
  exit $BUILD_EXIT_CODE
fi

echo "Backend executable successfully built."
