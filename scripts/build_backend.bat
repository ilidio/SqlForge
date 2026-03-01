@echo off
REM build_backend.bat
REM This script builds the Python backend into a single executable for Windows.

echo Building backend executable for Windows...

REM Navigate to the SqlForge-Backend directory
pushd SqlForge-Backend

REM Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

REM Build the executable
REM --onefile: Create a single executable file
REM --name: The name of the executable
REM --distpath: The directory to place the final executable in
REM --workpath: The directory for temporary build files
REM --clean: Clean PyInstaller cache and remove temporary files before building
REM --noconsole: Prevents the console window from appearing on Windows
call pyinstaller main.py ^
    --name sqlforge-backend ^
    --onefile ^
    --distpath ..\SqlForge\resources\bin ^
    --workpath build ^
    --clean ^
    --noconsole

set BUILD_EXIT_CODE=%errorlevel%

REM Deactivate and return to the original directory
if defined VIRTUAL_ENV (
    call deactivate
)
popd

if %BUILD_EXIT_CODE% neq 0 (
  echo PyInstaller build failed with exit code %BUILD_EXIT_CODE%.
  exit /b %BUILD_EXIT_CODE%
)

echo Backend executable successfully built.
