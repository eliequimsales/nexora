@echo off
title Nexora - Railway Setup
color 0A

echo.
echo  ========================================
echo   NEXORA - Deploy Railway em 5 minutos
echo  ========================================
echo.
echo  PASSO 1/3: Fazendo login no Railway...
echo  (vai abrir uma aba no seu browser)
echo.
railway login
if %errorlevel% neq 0 (
    echo.
    echo  ERRO no login. Tente novamente.
    pause
    exit /b 1
)

echo.
echo  Login feito! Continuando setup...
echo.
echo  PASSO 2/3: Criando projeto no Railway...
cd /d C:\Users\eli\Downloads\Documents\saas-platform

railway init --name nexora
if %errorlevel% neq 0 (
    echo.
    echo  Projeto pode ja existir. Tentando linkar...
    railway link
)

echo.
echo  PASSO 3/3: Configurando servico API...
railway service create --name api 2>nul || echo "Servico api ja existe"

echo.
echo  ========================================
echo   Agora rode: RAILWAY-SETUP-SERVICES.bat
echo  ========================================
echo.
pause
