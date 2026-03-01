#!/bin/bash

# package.sh
# This script builds the SqlForge Electron application for various platforms and architectures.

# --- Helper Functions ---

# Function to display help message
display_help() {
  echo "Usage: $0 [TARGET_OS] [TARGET_ARCH]"
  echo ""
  echo "Builds the SqlForge Electron application for the specified target OS and architecture."
  echo "If no arguments are provided, it defaults to the host OS and architecture."
  echo ""
  echo "Arguments:"
  echo "  TARGET_OS    The operating system to build for. Possible values: win, mac, linux."
  echo "               (Default: detected host OS)"
  echo "  TARGET_ARCH  The architecture to build for. Possible values: x64, arm64, ia32."
  echo "               (Default: detected host architecture)"
  echo ""
  echo "Examples:"
  echo "  $0                     # Build for current host OS and architecture"
  echo "  $0 mac                 # Build for macOS (default arch)"
  echo "  $0 linux x64           # Build for Linux x64"
  echo "  $0 win arm64           # Build for Windows arm64"
  echo ""
  echo "Cross-compilation Notes:"
  echo "  - Building for macOS (.dmg, .pkg) generally requires a macOS host."
  echo "  - Building for Windows (.exe, .msi) from Linux/macOS requires Wine to be installed."
  echo "  - Building for arm64 targets might require specific dependencies or toolchains."
  echo "  - 'ia32' architecture is typically for older 32-bit systems."
  echo ""
}

# Function to detect host OS and architecture
get_host_os_and_arch() {
  HOST_OS_RAW=$(uname -s)
  HOST_ARCH_RAW=$(uname -m)

  case "$HOST_OS_RAW" in
    Linux*)   DEFAULT_OS="linux" ;;
    Darwin*)  DEFAULT_OS="mac" ;;
    CYGWIN*|MINGW*|MSYS*) DEFAULT_OS="win" ;;
    *)        DEFAULT_OS="linux" # Default to linux for unknown
  esac

  case "$HOST_ARCH_RAW" in
    x86_64)   DEFAULT_ARCH="x64" ;;
    arm64)    DEFAULT_ARCH="arm64" ;;
    aarch64)  DEFAULT_ARCH="arm64" ;;
    *)        DEFAULT_ARCH="x64" # Default to x64 for unknown
  esac

  echo "Detected host OS: $DEFAULT_OS, Architecture: $DEFAULT_ARCH"
}

# Function to generate application icons
generate_icons() {
  echo "Generating application icons from public/logo.svg..."
  mkdir -p assets/build/icons

  # Use rsvg-convert to create a high-resolution base PNG from the SVG
  RSVG_CONVERT_CMD="/opt/homebrew/bin/rsvg-convert -w 1024 -h 1024 public/logo.svg -o assets/build/icons/base_icon.png"
  echo "Executing: $RSVG_CONVERT_CMD"
  eval "$RSVG_CONVERT_CMD"
  if [ $? -ne 0 ]; then
    echo "Error: rsvg-convert failed to generate base PNG. Is librsvg installed?"
    exit 1
  fi

  # Generate PNGs for various sizes from the base PNG using magick
  magick assets/build/icons/base_icon.png -resize 16x16 assets/build/icons/icon_16x16.png
  magick assets/build/icons/base_icon.png -resize 32x32 assets/build/icons/icon_32x32.png
  magick assets/build/icons/base_icon.png -resize 48x48 assets/build/icons/icon_48x48.png
  magick assets/build/icons/base_icon.png -resize 64x64 assets/build/icons/icon_64x64.png
  magick assets/build/icons/base_icon.png -resize 128x128 assets/build/icons/icon_128x128.png
  magick assets/build/icons/base_icon.png -resize 256x256 assets/build/icons/icon_256x256.png
  magick assets/build/icons/base_icon.png -resize 512x512 assets/build/icons/icon_512x512.png
  magick assets/build/icons/base_icon.png -resize 1024x1024 assets/build/icons/icon_1024x1024.png
  
  # Generate icon.png as a generic fallback
  cp assets/build/icons/icon_256x256.png assets/build/icons/icon.png

  # Generate .icns for macOS from the base PNG
  magick assets/build/icons/base_icon.png -format icns assets/build/icons/icon.icns
  if [ $? -ne 0 ]; then
    echo "Warning: .icns generation using magick failed or is not optimal. Ensure ImageMagick is properly configured."
  fi

  # Generate .ico for Windows from the PNGs
  magick assets/build/icons/icon_16x16.png \
         assets/build/icons/icon_32x32.png \
         assets/build/icons/icon_48x48.png \
         assets/build/icons/icon_64x64.png \
         assets/build/icons/icon_128x128.png \
         assets/build/icons/icon_256x256.png \
         assets/build/icons/icon.ico
  if [ $? -ne 0 ]; then
    echo "Warning: .ico generation using magick failed. Ensure ImageMagick is properly configured."
  fi

  echo "Icon generation complete."
}


# --- Main Script Logic ---

# Check for help argument
if [[ "$1" == "help" || "$1" == "-h" || "$1" == "--help" ]]; then
  display_help
  exit 0
fi

# Detect host defaults
get_host_os_and_arch

# Assign target OS and ARCH with defaults
TARGET_OS=${1:-$DEFAULT_OS}
TARGET_ARCH=${2:-$DEFAULT_ARCH}

echo "Building for Target OS: $TARGET_OS, Target Architecture: $TARGET_ARCH"

# Build the backend executable first
./scripts/build_backend.sh "$TARGET_OS"

# Navigate to the SqlForge directory
pushd SqlForge > /dev/null

# Clean previous build artifacts
echo "Cleaning previous build artifacts..."
rm -rf dist out

# Generate application icons
generate_icons

# Install dependencies (if not already installed)
echo "Installing SqlForge dependencies (if necessary)..."
npm install

# Build the React frontend
echo "Building React frontend..."
npm run build

# Construct the electron-builder command
BUILDER_CMD="npx electron-builder"

case "$TARGET_OS" in
  win)
    BUILDER_CMD+=" --win"
    ;;
  mac)
    BUILDER_CMD+=" --mac"
    ;;
  linux)
    BUILDER_CMD+=" --linux"
    ;;
  *)
    echo "Error: Invalid TARGET_OS specified or detected: $TARGET_OS"
    display_help
    exit 1
    ;;
esac

case "$TARGET_ARCH" in
  x64)
    BUILDER_CMD+=" --x64"
    ;;
  arm64)
    BUILDER_CMD+=" --arm64"
    ;;
  ia32)
    BUILDER_CMD+=" --ia32"
    ;;
  *)
    echo "Error: Invalid TARGET_ARCH specified or detected: $TARGET_ARCH"
    display_help
    exit 1
    ;;
esac

echo "Executing: $BUILDER_CMD"
NODE_GYP_FORCE_PYTHON=/Users/ilidiomartins/miniconda3/bin/python3 eval "$BUILDER_CMD"

BUILD_EXIT_CODE=$?

# Navigate back to the original directory
popd > /dev/null

if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo "Electron build failed with exit code $BUILD_EXIT_CODE."
  exit $BUILD_EXIT_CODE
fi

echo "Build complete!"
echo "Generated installer files (usually in SqlForge/dist/):"
case "$TARGET_OS" in
  win)
    ls -l SqlForge/dist/*.exe SqlForge/dist/*.msi 2>/dev/null || echo "  No Windows installers found."
    ;;
  mac)
    ls -l SqlForge/dist/*.dmg SqlForge/dist/*.pkg 2>/dev/null || echo "  No macOS installers found."
    ;;
  linux)
    ls -l SqlForge/dist/*.AppImage SqlForge/dist/*.deb SqlForge/dist/*.rpm 2>/dev/null || echo "  No Linux installers found."
    ;;
esac
