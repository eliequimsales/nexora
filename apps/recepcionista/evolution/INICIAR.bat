@echo off
title Nexora Atendente - WhatsApp online
echo Iniciando a Evolution + tunel do Nexora Atendente...
echo Deixe esta janela aberta enquanto quiser o WhatsApp funcionando.
echo Para parar, feche a janela ou pressione Ctrl+C.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0manter-online.ps1"
pause
