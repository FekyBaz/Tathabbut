@echo off
setlocal
pushd "%~dp0"

echo [dev-build] Building Tathabbut extension into dist\ ...
call npm run dev:build
set "RESULT=%ERRORLEVEL%"
popd

if not "%RESULT%"=="0" echo [dev-build] BUILD FAILED. Fix the errors above, then run dev-build.cmd again.
if not "%RESULT%"=="0" exit /b %RESULT%

echo [dev-build] Build OK. Load unpacked from: %~dp0dist
echo [dev-build] In Brave open brave://extensions/ ; first time use Load unpacked and select that folder, then after every rebuild click Reload on the Tathabbut card.
exit /b 0
