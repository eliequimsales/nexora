# Nexora Atendente — mantem a Evolution API online e a producao sempre apontada pra ela.
#
# O que faz, em loop, sozinho:
#   1. Garante que a Evolution (Docker) esta de pe.
#   2. Sobe um tunel publico (cloudflared) para a Evolution local.
#   3. Sempre que o endereco do tunel muda, atualiza EVOLUTION_API_URL na
#      producao (Railway) e redeploya — assim o "fetch failed" nao volta.
#   4. Se o tunel cair, reergue e repete.
#
# Rode com INICIAR.bat (duplo clique) ou:  powershell -ExecutionPolicy Bypass -File manter-online.ps1
# Deixe esta janela aberta enquanto quiser o WhatsApp no ar. Ctrl+C encerra.

$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

$Service   = "recepcionista"
$LocalPort = 8099
$LastUrl   = ""

function Log($msg) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg) }

# Carrega EVOLUTION_API_KEY do .env
if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*EVOLUTION_API_KEY\s*=\s*(.+)\s*$') { $env:EVOLUTION_API_KEY = $Matches[1].Trim() }
  }
}
if (-not $env:EVOLUTION_API_KEY) { Log "ERRO: EVOLUTION_API_KEY ausente no .env"; exit 1 }

Log "Subindo a Evolution (Docker)..."
docker compose up -d | Out-Null

# Espera a Evolution responder localmente
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$LocalPort/instance/fetchInstances" `
         -Headers @{ apikey = $env:EVOLUTION_API_KEY } -TimeoutSec 5 -UseBasicParsing
    if ($r.StatusCode -eq 200) { Log "Evolution local OK."; break }
  } catch { Start-Sleep 3 }
}

function Update-Prod($url) {
  Log "Novo endereco: $url  ->  atualizando producao e redeployando..."
  railway variable set "EVOLUTION_API_URL=$url" --service $Service | Out-Null
  railway redeploy --service $Service --yes | Out-Null
  Log "Producao atualizada. WhatsApp online neste endereco."
}

while ($true) {
  # Inicia o tunel e le a saida em tempo real
  $log = Join-Path $env:TEMP "nexora-tunnel.log"
  if (Test-Path $log) { Remove-Item $log -Force }

  $proc = Start-Process -FilePath ".\cloudflared.exe" `
          -ArgumentList "tunnel --url http://localhost:$LocalPort" `
          -RedirectStandardError $log -RedirectStandardOutput "$log.out" `
          -NoNewWindow -PassThru

  Log "Tunel iniciando (pid $($proc.Id))..."
  $url = ""
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep 3
    if (Test-Path $log) {
      $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches |
           ForEach-Object { $_.Matches.Value } | Where-Object { $_ -notmatch "^https://api\." } |
           Select-Object -Last 1
      if ($m) { $url = $m; break }
    }
    if ($proc.HasExited) { break }
  }

  if ($url -and $url -ne $LastUrl) { Update-Prod $url; $LastUrl = $url }
  elseif ($url) { Log "Tunel de volta no mesmo endereco: $url" }
  else { Log "Nao consegui obter o endereco do tunel; tentando de novo..." }

  # Vigia o tunel; se cair, o while reinicia tudo
  while (-not $proc.HasExited) { Start-Sleep 10 }
  Log "Tunel caiu. Reerguendo em 5s..."
  Start-Sleep 5
}
