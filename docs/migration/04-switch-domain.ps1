# Step 4: move GitHub Pages to the new host.
#
# Pages serves one custom domain per repo, so this is the moment the old host
# stops serving the site. The site is deployed with actions/deploy-pages, which
# ignores a CNAME file, so the domain is set here through the Pages API.

. "$PSScriptRoot/config.ps1"

Write-Step "Checking $SiteDomain resolves to $PagesTarget"
$record = Resolve-DnsName $SiteDomain -Type CNAME -Server 1.1.1.1 -DnsOnly -ErrorAction SilentlyContinue |
  Where-Object { $_.Type -eq 'CNAME' } | Select-Object -First 1
if ($record.NameHost -ne $PagesTarget) { throw "$SiteDomain does not resolve to $PagesTarget yet. Run 01-add-dns.ps1." }
Write-Ok 'resolves'

Write-Step "Setting the Pages custom domain on $CurrentRepo"
gh api -X PUT "repos/$CurrentRepo/pages" -f "cname=$SiteDomain" --silent
Write-Ok "custom domain = $SiteDomain"

Write-Step 'Waiting for the TLS certificate (usually a few minutes, up to an hour)'
$deadline = (Get-Date).AddMinutes(60)
do {
  $state = gh api "repos/$CurrentRepo/pages" --jq '.https_certificate.state // "none"'
  Write-Note "certificate state: $state"
  if ($state -eq 'approved') { break }
  if ($state -in 'errored', 'bad_authz') { throw "Certificate provisioning failed ($state). Check Settings > Pages." }
  Start-Sleep -Seconds 30
} while ((Get-Date) -lt $deadline)
if ($state -ne 'approved') { throw 'Timed out waiting for the certificate. Re-run this script to keep waiting.' }

Write-Step 'Enforcing HTTPS'
gh api -X PUT "repos/$CurrentRepo/pages" -f "cname=$SiteDomain" -F https_enforced=true --silent
Write-Ok 'https enforced'

Write-Host ''
Write-Host "The site is on https://$SiteDomain. Next: .\05-verify.ps1" -ForegroundColor Cyan
