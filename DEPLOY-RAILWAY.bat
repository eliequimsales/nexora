@echo off
title Nexora - Deploy Railway Automatico
color 0A
cls

echo.
echo  =====================================================
echo    NEXORA - Deploy Automatico no Railway
echo    Codigo ja no GitHub: github.com/eliequimsales/nexora
echo  =====================================================
echo.
echo  Etapa 1/4: Login no Railway...
echo  (abre uma aba no browser - clica em AUTHORIZE)
echo.
railway login
if %errorlevel% neq 0 (
    echo.
    echo  [ERRO] Login falhou. Verifique sua conexao.
    pause
    exit /b 1
)
echo  [OK] Login feito!
echo.

echo  Etapa 2/4: Criando projeto nexora no Railway...
cd /d "C:\Users\eli\Downloads\Documents\saas-platform"
railway init --name nexora
echo  [OK] Projeto criado!
echo.

echo  Etapa 3/4: Configurando servico API (NestJS)...
railway service create --name api
echo  [OK] Servico API criado!
echo.

echo  Etapa 4/4: Configurando variaveis de ambiente (API)...
railway variables --service api --set "NODE_ENV=development"
railway variables --service api --set "PORT=3001"
railway variables --service api --set "LLM_PROVIDER=mock"
railway variables --service api --set "JWT_SECRET=nexora-dev-jwt-secret-change-in-production-48chars-minimum-ok"
railway variables --service api --set "INTEGRATION_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
railway variables --service api --set "ALLOWED_ORIGINS=*"
railway variables --service api --set "APP_URL=https://placeholder-update-after-app-deploys.railway.app"
echo  [OK] Variaveis configuradas!
echo.

echo  =====================================================
echo   PROXIMOS PASSOS (no painel Railway):
echo   1. Adicione PostgreSQL: + New > Database > PostgreSQL
echo   2. Adicione Redis:      + New > Database > Redis
echo   3. Em Settings > Source > conecte o GitHub repo
echo      nexora, Dockerfile: apps/api/Dockerfile
echo   4. Linke DATABASE_URL e REDIS_URL ao servico api
echo   URL: https://railway.com/dashboard
echo  =====================================================
echo.
echo  Abrindo o painel Railway no browser...
start https://railway.com/dashboard
echo.
pause
