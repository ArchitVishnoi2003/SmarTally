# Deploy Wholesale Tally API to Vercel (free Hobby — no credit card)
# Requires Vercel CLI 39+ (recommended: npm install -g vercel@latest)
# Run from project root:  .\scripts\deploy-vercel.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Wholesale Tally — Vercel Deploy ===" -ForegroundColor Cyan

# 1. Login check
Write-Host "`nChecking Vercel login..."
$whoami = npx vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run this first (opens browser):" -ForegroundColor Yellow
    Write-Host "  npx vercel login" -ForegroundColor White
    exit 1
}
Write-Host "Logged in as: $whoami" -ForegroundColor Green

# 2. Install deps
Write-Host "`nInstalling npm dependencies..."
npm install

# 3. GEMINI_API_KEY from .env or functions/.env if present
$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path $Root "functions\.env"
}
if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*GEMINI_API_KEY\s*=' } | Select-Object -First 1
    if ($line) {
        $geminiKey = ($line -split '=', 2)[1].Trim().Trim('"')
        if ($geminiKey -and $geminiKey -ne 'your_key_here') {
            Write-Host "Setting GEMINI_API_KEY on Vercel (production)..."
            $geminiKey | npx vercel env add GEMINI_API_KEY production --force 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  (env may already exist — continuing)" -ForegroundColor DarkYellow
            }
        }
    }
}

# 4. Firebase service account (required for Firestore)
$saPath = $env:FIREBASE_SERVICE_ACCOUNT_PATH
if (-not $saPath) {
    $defaultSa = Join-Path $Root "firebase-service-account.json"
    if (Test-Path $defaultSa) { $saPath = $defaultSa }
}

if ($saPath -and (Test-Path $saPath)) {
    Write-Host "Setting FIREBASE_SERVICE_ACCOUNT_JSON from $saPath ..."
    $json = Get-Content $saPath -Raw
    $json | npx vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production --force 2>$null
} else {
    Write-Host ""
    Write-Host "WARNING: firebase-service-account.json not found." -ForegroundColor Yellow
    Write-Host "Download from Firebase Console -> Project settings -> Service accounts -> Generate key"
    Write-Host "Save as: $Root\firebase-service-account.json"
    Write-Host "Or set env: `$env:FIREBASE_SERVICE_ACCOUNT_PATH = 'C:\path\to\file.json'"
    Write-Host "Deploy will succeed but API calls will fail until this is set.`n" -ForegroundColor Yellow
}

# 5. Deploy to production
Write-Host "`nDeploying to production..."
npx vercel --prod --yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Done ===" -ForegroundColor Green
    Write-Host "Copy your URL from above, then set in app/lib/config/app_config.dart:"
    Write-Host "  apiBaseUrl = 'https://YOUR-PROJECT.vercel.app/api'"
    Write-Host ""
    Write-Host "Or run Flutter with:"
    Write-Host "  flutter run --dart-define=API_BASE_URL=https://YOUR-PROJECT.vercel.app/api"
}
