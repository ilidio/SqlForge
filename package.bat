@echo off
REM package.bat
REM This script builds the SqlForge Electron application for Windows.

REM --- Helper Functions ---

REM Function to display help message
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

REM --- Main Script Logic ---

REM Check for help argument or no arguments
if "%1"=="" goto :check_help
if /i "%1"=="help" goto :check_help
if /i "%1"=="-h" goto :check_help
if /i "%1"=="--help" goto :check_help
goto :skip_help

:check_help
call :display_help
exit /b 0

:skip_help

REM Assign target architecture with default
set "TARGET_ARCH=%1"
if "%TARGET_ARCH%"=="" set "TARGET_ARCH=x64"

echo Building for Target OS: Windows, Target Architecture: %TARGET_ARCH%

REM Navigate to the frontend directory
pushd frontend

REM Clean previous build artifacts
echo Cleaning previous build artifacts...
rd /s /q dist out 2>nul

REM Ensure icons directory exists for electron-builder
if not exist "build\icons" mkdir "build\icons"

REM Install dependencies (if not already installed)
echo Installing frontend dependencies (if necessary)...
call npm install

REM Build the React frontend
echo Building React frontend...
call npm run build

REM Construct and execute the electron-builder command
set "BUILDER_CMD=npx electron-builder --win --arch %TARGET_ARCH%"

echo Executing: %BUILDER_CMD%
call %BUILDER_CMD%

if %errorlevel% neq 0 (
  echo Electron build failed with exit code %errorlevel%.
  popd
  exit /b %errorlevel%
)

REM Navigate back to the original directory
popd

echo Build complete!
echo Generated installer files (usually in frontend\dist\):
dir frontend\dist\*.exe frontend\dist\*.msi 2>nul || echo   No Windows installers found.
