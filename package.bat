@echo off
REM package.bat
REM This script builds the SqlForge Electron application for Windows.

REM Check for help argument
if "%1"=="help" goto :display_help
if "%1"=="-h" goto :display_help
if "%1"=="--help" goto :display_help

goto :main

:display_help
echo Usage: %~n0 [TARGET_ARCH]
echo.
echo Builds the SqlForge Electron application for the specified target architecture.
echo If no argument is provided, it defaults to x64.
echo.
echo Arguments:
echo   TARGET_ARCH  The architecture to build for. Possible values: x64, arm64, ia32.
echo                (Default: x64)
echo.
echo Examples:
echo   %~n0         REM Build for Windows x64
echo   %~n0 arm64    REM Build for Windows arm64
echo   %~n0 ia32     REM Build for Windows ia32
echo.
exit /b 0

:main
REM Assign target architecture with default
set "TARGET_ARCH=%1"
if "%TARGET_ARCH%"=="" set "TARGET_ARCH=x64"

echo Building for Target OS: Windows, Target Architecture: %TARGET_ARCH%

REM Build the backend executable first
echo Step 1: Building Python Backend...
call scripts\build_backend.bat
if %errorlevel% neq 0 (
  echo Error: Backend build failed.
  exit /b %errorlevel%
)

REM Navigate to the SqlForge directory
pushd SqlForge

REM Clean previous build artifacts
echo Step 2: Cleaning previous build artifacts...
if exist "dist" rd /s /q dist
if exist "out" rd /s /q out

REM Ensure icons directory exists
if not exist "build\icons" mkdir "build\icons"

REM Install dependencies (if not already installed)
echo Step 3: Installing SqlForge dependencies...
call npm install
if %errorlevel% neq 0 (
  echo Error: npm install failed.
  popd
  exit /b %errorlevel%
)

REM Build the React app
echo Step 4: Building React app (Vite)...
call npm run build
if %errorlevel% neq 0 (
  echo Error: Vite build failed.
  popd
  exit /b %errorlevel%
)

REM Construct and execute the electron-builder command
set "BUILDER_CMD=npx electron-builder --win --arch %TARGET_ARCH%"

echo Step 5: Packaging Electron App...
echo Executing: %BUILDER_CMD%
call %BUILDER_CMD%

if %errorlevel% neq 0 (
  echo Error: Electron build failed with exit code %errorlevel%.
  popd
  exit /b %errorlevel%
)

REM Navigate back to the original directory
popd

echo.
echo Build complete!
echo Generated installer files:
dir SqlForge\dist\*.exe 2>nul || echo   No Windows installers found.
exit /b 0
