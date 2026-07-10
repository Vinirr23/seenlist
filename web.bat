@echo off

start powershell -NoExit -Command "cd 'C:\Users\Vinicius\Desktop\SeenList-FINAL'; pnpm --filter @seenlist/web dev"

echo Aguardando o servidor iniciar...

:loop
powershell -Command "try { Invoke-WebRequest http://localhost:3000 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"

if errorlevel 1 (
    timeout /t 1 >nul
    goto loop
)

start chrome --incognito http://localhost:3000


