# Step 5: smoke-test the new site and vote API. Read-only: it does not cast a vote.

. "$PSScriptRoot/config.ps1"

Use-Subscription | Out-Null
$hostName = Get-FunctionAppHost
$api      = "https://$hostName"
$origin   = "https://$SiteDomain"
$failures = 0

function Test-Check([string] $name, [scriptblock] $check) {
  try {
    $detail = & $check
    Write-Ok "$name $detail"
  } catch {
    Write-Host "    XX  $name - $($_.Exception.Message)" -ForegroundColor Red
    $script:failures++
  }
}

Write-Step "Site on $origin"
foreach ($path in '/', '/interlink/', '/interlink/roadmap/') {
  Test-Check "GET $path" {
    $res = Invoke-WebRequest "$origin$path" -SkipHttpErrorCheck
    if ($res.StatusCode -ne 200) { throw "status $($res.StatusCode)" }
    "($($res.StatusCode))"
  }
}

Test-Check 'Built against the new vote API' {
  # PUBLIC_VOTE_API_URL is inlined into the roadmap page's script at build time.
  $page = Invoke-WebRequest "$origin/interlink/roadmap/"
  $bundles = [regex]::Matches($page.Content, 'src="(/_astro/[^"]+\.js)"') | ForEach-Object { $_.Groups[1].Value }
  $found = $false
  foreach ($bundle in @($bundles) + @('')) {
    $body = if ($bundle) { (Invoke-WebRequest "$origin$bundle").Content } else { $page.Content }
    if ($body.Contains($hostName)) { $found = $true; break }
  }
  if (-not $found) { throw "the page does not reference $hostName. Re-run Deploy Site after step 3." }
}

Test-Check 'HTTP redirects to HTTPS' {
  # curl.exe, because Invoke-WebRequest throws on an unfollowed redirect.
  $status = curl.exe -s -o NUL -w '%{http_code}' "http://$SiteDomain/"
  if ($status -notin '301', '308') { throw "status $status" }
  "($status)"
}

Write-Step "Vote API on $api"
Test-Check 'GET /api/vote/{itemId}' {
  $res = Invoke-RestMethod "$api/api/vote/migration-smoke-test"
  if ($res.count -ne 0) { throw "unexpected body $($res | ConvertTo-Json -Compress)" }
  '(count 0)'
}

Test-Check 'CORS preflight allows the site' {
  # A real browser preflight: it carries Access-Control-Request-Method, so the
  # Functions host answers it from the platform CORS setting, not our code.
  $res = Invoke-WebRequest "$api/api/vote" -Method Options -SkipHttpErrorCheck -Headers @{
    Origin                           = $origin
    'Access-Control-Request-Method'  = 'POST'
    'Access-Control-Request-Headers' = 'content-type'
  }
  $allowed = "$($res.Headers['Access-Control-Allow-Origin'])"
  if ($allowed -ne $origin) { throw "Access-Control-Allow-Origin is '$allowed'. Check platform CORS (re-run step 2)." }
}

Test-Check 'CORS refuses another origin' {
  $res = Invoke-WebRequest "$api/api/vote" -Method Options -SkipHttpErrorCheck -Headers @{
    Origin                          = 'https://example.com'
    'Access-Control-Request-Method' = 'POST'
  }
  $allowed = "$($res.Headers['Access-Control-Allow-Origin'])"
  if ($allowed -eq 'https://example.com') { throw 'the API echoed an origin that is not allowed' }
}

Write-Host ''
if ($failures -gt 0) {
  Write-Host "$failures check(s) failed. Fix them before step 6." -ForegroundColor Red
  exit 1
}
Write-Host 'All checks passed. Cast one real vote on the roadmap page to confirm writes, then run .\06-remove-old.ps1' -ForegroundColor Cyan
