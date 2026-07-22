param(
  [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN,
  [switch]$SkipMigration,
  [switch]$SkipFunctions
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($AccessToken)) { throw 'SUPABASE_ACCESS_TOKEN is required.' }
$root = Split-Path -Parent $PSScriptRoot
$envLine = Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^VITE_SUPABASE_URL=' } | Select-Object -First 1
if (-not $envLine) { throw 'VITE_SUPABASE_URL is missing from .env.' }
$projectUrl = (($envLine -split '=', 2)[1]).Trim().Trim('"')
$projectRef = ([uri]$projectUrl).Host.Split('.')[0]
$headers = @{ Authorization = "Bearer $AccessToken" }

$projects = Invoke-RestMethod -Headers $headers -Uri 'https://api.supabase.com/v1/projects' -Method Get
if (-not ($projects | Where-Object { $_.id -eq $projectRef })) { throw "Project $projectRef is not accessible with this token." }

if (-not $SkipMigration) {
  $migrationPath = Join-Path $root 'supabase\migrations\20260723000001_admin_operations_hub.sql'
  $migration = Get-Content -Raw -Encoding UTF8 $migrationPath
  $historyCheck = @{ query = "select version from supabase_migrations.schema_migrations where version = '20260723000001'"; read_only = $true } | ConvertTo-Json -Compress
  $history = Invoke-RestMethod -Headers $headers -ContentType 'application/json' -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" -Method Post -Body $historyCheck
  if (-not $history) {
    $sql = "begin;`n$migration`ninsert into supabase_migrations.schema_migrations(version, name, statements) values ('20260723000001', 'admin_operations_hub', array['Applied from repository migration 20260723000001_admin_operations_hub.sql']);`ncommit;"
    $payload = @{ query = $sql; read_only = $false } | ConvertTo-Json -Depth 3 -Compress
    Invoke-RestMethod -Headers $headers -ContentType 'application/json' -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" -Method Post -Body $payload | Out-Null
  }
}

if (-not $SkipFunctions) {
  Add-Type -AssemblyName System.Net.Http
  $client = [System.Net.Http.HttpClient]::new()
  $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $AccessToken)
  foreach ($slug in @('submit-registration', 'send-email-v2', 'gmail-sync', 'team-invite')) {
    $path = Join-Path $root "supabase\functions\$slug\index.ts"
    $form = [System.Net.Http.MultipartFormDataContent]::new()
    $metadata = @{ entrypoint_path = 'index.ts'; name = $slug; verify_jwt = $true } | ConvertTo-Json -Compress
    $form.Add([System.Net.Http.StringContent]::new($metadata, [Text.Encoding]::UTF8, 'application/json'), 'metadata')
    $file = [System.Net.Http.ByteArrayContent]::new([IO.File]::ReadAllBytes($path))
    $file.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/typescript')
    $form.Add($file, 'file', 'index.ts')
    $response = $client.PostAsync("https://api.supabase.com/v1/projects/$projectRef/functions/deploy?slug=$slug", $form).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { throw "Deploy $slug failed ($($response.StatusCode)): $body" }
    Write-Host "Deployed $slug"
  }
  $client.Dispose()
}

Write-Host "Supabase operations deployment complete for $projectRef."
