@echo off

echo ================================
echo      INICIANDO SEENLIST
echo ================================

start powershell -NoExit -Command "cd 'C:\Users\Vinicius\Desktop\SeenList'; pnpm --filter @seenlist/web dev"

start powershell -NoExit -Command "cd 'C:\Users\Vinicius\Desktop\SeenList'; pnpm --filter @seenlist/mobile dev"

echo.
echo Aguardando o servidor Web iniciar...

:loop
powershell -Command "try { Invoke-WebRequest http://localhost:3000 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"

if errorlevel 1 (
    timeout /t 1 >nul
    goto loop
)

echo Abrindo Chrome...

start chrome --incognito http://localhost:3000

echo.
echo ========================================
echo  SeenList iniciado com sucesso!
echo ========================================