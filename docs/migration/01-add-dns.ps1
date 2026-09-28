# Step 1: point the new site host at GitHub Pages.
#
# Safe to run any time: nothing serves on the new host until step 4 claims it.
# Run it first so DNS has propagated by the time step 4 needs it.

. "$PSScriptRoot/config.ps1"

$recordName = Get-RecordName $SiteDomain

Write-Step "CNAME $SiteDomain -> $PagesTarget"
if ($DnsZoneResourceGroup) {
  Use-Subscription | Out-Null
  az network dns record-set cname set-record `
    -g $DnsZoneResourceGroup -z $DnsZone -n $recordName -c $PagesTarget --ttl 3600 `
    --query '{fqdn:fqdn, target:CNAMERecord.cname}' -o table
} else {
  Write-Host ''
  Write-Host '    cse-icon.com is not configured as an Azure DNS zone in config.ps1.'
  Write-Host '    Add this record in your DNS provider, then re-run this script to check it:'
  Write-Host ''
  Write-Host "      Type: CNAME    Name: $recordName    Value: $PagesTarget    TTL: 3600"
  Write-Host ''
}

Write-Step 'Checking resolution (public resolver 1.1.1.1)'
$record = Resolve-DnsName $SiteDomain -Type CNAME -Server 1.1.1.1 -DnsOnly -ErrorAction SilentlyContinue |
  Where-Object { $_.Type -eq 'CNAME' } | Select-Object -First 1
if ($record.NameHost -eq $PagesTarget) {
  Write-Ok "$SiteDomain resolves to $PagesTarget"
} else {
  Write-Note "$SiteDomain does not resolve to $PagesTarget yet. Propagation usually takes 5-30 minutes; re-run to check."
}
