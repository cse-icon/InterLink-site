# Step 3: point the repo's Actions variables at the new Function App.
#
# From here on, any deploy targets the new Function App. The site still being
# served on the old host will fail to vote until step 4, which is expected.
#
# AZURE_CLIENT_ID, AZURE_TENANT_ID and AZURE_SUBSCRIPTION_ID are unchanged: the
# deploy app registration is the same one as before.

. "$PSScriptRoot/config.ps1"

Use-Subscription | Out-Null
$hostName = Get-FunctionAppHost
if (-not $hostName) { throw 'Run 02-create-azure.ps1 first.' }

Write-Step "Actions variables on $CurrentRepo"
$variables = [ordered]@{
  AZURE_FUNCTIONAPP_NAME = $FunctionApp
  PUBLIC_VOTE_API_URL    = "https://$hostName"
}
foreach ($name in $variables.Keys) {
  gh variable set $name --repo $CurrentRepo --body $variables[$name]
  Write-Ok "$name = $($variables[$name])"
}

Write-Step 'Removing variables nothing reads any more'
foreach ($name in 'PROJECT_NUMBER', 'APP_INSTALLATION_ID', 'SITE_URL') {
  try {
    gh variable delete $name --repo $CurrentRepo 2>$null
    Write-Ok "deleted $name"
  } catch {
    Write-Ok "$name not present"
  }
}

Write-Host ''
Write-Host 'Unchanged, and still needed: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, APP_ID (variables) and APP_PRIVATE_KEY (secret).'
Write-Host 'Next: merge the PR and watch both deploys. See README.md, step 3b.' -ForegroundColor Cyan
