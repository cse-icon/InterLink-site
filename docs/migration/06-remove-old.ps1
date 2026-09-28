# Step 6: delete everything legacy. Irreversible.
#
#   1. The old host's DNS record. Do not skip this: a CNAME to github.io that no
#      repo claims can be claimed by anyone's GitHub Pages site (subdomain takeover).
#   2. The old resource group, with the old Function App, storage account (and
#      every vote in it), App Service plan and Application Insights.
#   3. This repo's federated credential on the old deploy app registration. The
#      app itself is shared with other repos, so it is left in place; its role
#      assignment on the old resource group goes with the resource group.
#
# It lists everything first and asks you to type the resource group name.

. "$PSScriptRoot/config.ps1"

Use-Subscription | Out-Null
$oldRecordName = Get-RecordName $OldDomain
$newAppId = Get-DeployAppId
$oldAppId = Get-DeployAppId -displayName $OldDeployAppName
$oldSubject = "repo:${Org}/${OldRepoName}:ref:refs/heads/main"
$oldCredentialId = if ($oldAppId) {
  az ad app federated-credential list --id $oldAppId --query "[?subject=='$oldSubject'].id | [0]" -o tsv
}
$currentClientId = gh variable get AZURE_CLIENT_ID --repo $CurrentRepo

# Refuse to run until the new setup is fully in use, so nothing live is deleted.
if (-not $newAppId -or $currentClientId -ne $newAppId) {
  throw 'AZURE_CLIENT_ID does not point at the new deploy app yet. Finish steps 2-5 first.'
}
if ($oldAppId -eq $newAppId) { throw '$OldDeployAppName and $DeployAppName resolve to the same app. Check config.ps1.' }
$pagesDomain = gh api "repos/$CurrentRepo/pages" --jq '.cname'
if ($pagesDomain -ne $SiteDomain) { throw "Pages still serves $pagesDomain. Run 04-switch-domain.ps1 first." }

Write-Step 'This will delete:'
Write-Host "    DNS     CNAME $OldDomain"
if ((az group exists -n $OldResourceGroup) -eq 'true') {
  Write-Host "    Azure   resource group $OldResourceGroup, containing:"
  az resource list -g $OldResourceGroup --query '[].{name:name, type:type}' -o table |
    ForEach-Object { Write-Host "              $_" }
} else {
  Write-Host "    Azure   resource group $OldResourceGroup (already gone)"
}
if ($oldCredentialId) {
  Write-Host "    Entra   federated credential $oldSubject"
  Write-Host "            on shared app '$OldDeployAppName' ($oldAppId), which is kept"
} else {
  Write-Host "    Entra   no credential for $oldSubject on '$OldDeployAppName' (already gone)"
}
Write-Host ''
Confirm-OrExit $OldResourceGroup 'Delete all of the above?'

Write-Step "DNS: CNAME $OldDomain"
if ($DnsZoneResourceGroup) {
  az network dns record-set cname delete -g $DnsZoneResourceGroup -z $DnsZone -n $oldRecordName --yes
  Write-Ok 'deleted'
} else {
  Write-Host "    Delete this record in your DNS provider now:  CNAME  $oldRecordName  ->  $PagesTarget"
  Read-Host '    Press Enter once it is deleted'
}

Write-Step "Azure: resource group $OldResourceGroup (takes a few minutes)"
if ((az group exists -n $OldResourceGroup) -eq 'true') {
  az group delete -n $OldResourceGroup --yes
  Write-Ok 'deleted'
} else {
  Write-Ok 'already gone'
}

Write-Step "Entra: this repo's credential on '$OldDeployAppName'"
if ($oldCredentialId) {
  az ad app federated-credential delete --id $oldAppId --federated-credential-id $oldCredentialId
  Write-Ok 'deleted; the app and its other repos are untouched'
} else {
  Write-Ok 'already gone'
}

Write-Host ''
Write-Host 'Legacy resources removed.' -ForegroundColor Cyan
Write-Host 'Note: if the old Application Insights wrote to a shared Log Analytics workspace'
Write-Host '(e.g. DefaultWorkspace-* in DefaultResourceGroup-SCUS), that workspace is shared and was left alone.'
Write-Host 'Next: rename the GitHub App by hand (README.md, step 6b), then .\07-rename-repo.ps1'
