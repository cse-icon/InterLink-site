# Step 6: delete everything legacy. Irreversible.
#
#   1. The old host's DNS record. Do not skip this: a CNAME to github.io that no
#      repo claims can be claimed by anyone's GitHub Pages site (subdomain takeover).
#   2. The old resource group, with the old Function App, storage account (and
#      every vote in it), App Service plan and Application Insights. The deploy
#      app's role assignment on that resource group goes with it.
#
# The shared deploy app registration is not touched. Its federated credential for
# the old repo name is removed in step 7, after the rename.
#
# It lists everything first and asks you to type the resource group name.

. "$PSScriptRoot/config.ps1"

Use-Subscription | Out-Null
$oldRecordName = Get-RecordName $OldDomain

# Refuse to run until the new setup is fully in use, so nothing live is deleted.
$apiUrl = gh variable get PUBLIC_VOTE_API_URL --repo $CurrentRepo
if ($apiUrl -ne "https://$(Get-FunctionAppHost)") {
  throw 'PUBLIC_VOTE_API_URL does not point at the new Function App yet. Finish steps 2-5 first.'
}
$functionAppName = gh variable get AZURE_FUNCTIONAPP_NAME --repo $CurrentRepo
if ($functionAppName -ne $FunctionApp) {
  throw 'AZURE_FUNCTIONAPP_NAME does not name the new Function App yet. Finish steps 2-5 first.'
}
$pagesDomain = gh api "repos/$CurrentRepo/pages" --jq '.cname'
if ($pagesDomain -ne $SiteDomain) { throw "Pages still serves $pagesDomain. Run 04-switch-domain.ps1 first." }

Write-Step 'This will delete:'
Write-Host "    DNS     CNAME $OldDomain (by hand, in GoDaddy)"
if ((az group exists -n $OldResourceGroup) -eq 'true') {
  Write-Host "    Azure   resource group $OldResourceGroup, containing:"
  az resource list -g $OldResourceGroup --query '[].{name:name, type:type}' -o table |
    ForEach-Object { Write-Host "              $_" }
} else {
  Write-Host "    Azure   resource group $OldResourceGroup (already gone)"
}
Write-Host ''
Confirm-OrExit $OldResourceGroup 'Delete all of the above?'

Write-Step "DNS: CNAME $OldDomain"
Write-Host "    Delete this record from the $DnsZone zone in GoDaddy now:  CNAME  $oldRecordName  ->  $PagesTarget"
Read-Host '    Press Enter once it is deleted'

Write-Step "Azure: resource group $OldResourceGroup (takes a few minutes)"
if ((az group exists -n $OldResourceGroup) -eq 'true') {
  az group delete -n $OldResourceGroup --yes
  Write-Ok 'deleted'
} else {
  Write-Ok 'already gone'
}

Write-Host ''
Write-Host 'Legacy resources removed.' -ForegroundColor Cyan
Write-Host 'Note: if the old Application Insights wrote to a shared Log Analytics workspace'
Write-Host '(e.g. DefaultWorkspace-* in DefaultResourceGroup-SCUS), that workspace is shared and was left alone.'
Write-Host 'Next: rename the GitHub App by hand (README.md, step 6b), then .\07-rename-repo.ps1'
