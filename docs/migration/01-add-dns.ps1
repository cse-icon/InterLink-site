# Step 1: point the new site host at GitHub Pages.
#
# Safe to run any time: nothing serves on the new host until step 4 claims it.
# Run it first so DNS has propagated by the time step 4 needs it.

. "$PSScriptRoot/config.ps1"

$recordName = Get-RecordName $SiteDomain

Write-Step "CNAME $SiteDomain -> $PagesTarget"
Write-Host ''
Write-Host "    Add this record to the $DnsZone zone in GoDaddy, then re-run this script to check it:"
Write-Host ''
Write-Host "      Type: CNAME    Name: $recordName    Value: $PagesTarget    TTL: 1 hour"
Write-Host ''

Write-Step 'Checking resolution (public resolver 1.1.1.1)'
$record = Resolve-DnsName $SiteDomain -Type CNAME -Server 1.1.1.1 -DnsOnly -ErrorAction SilentlyContinue |
  Where-Object { $_.Type -eq 'CNAME' } | Select-Object -First 1
if ($record.NameHost -eq $PagesTarget) {
  Write-Ok "$SiteDomain resolves to $PagesTarget"
} else {
  Write-Note "$SiteDomain does not resolve to $PagesTarget yet. Propagation usually takes 5-30 minutes; re-run to check."
}
