# Step 2: create the new Azure resources and the GitHub Actions deploy identity.
#
# Idempotent: anything that already exists is left as it is, so the script can be
# re-run after a failure. The legacy resources are not touched.
#
# Needs: Contributor on the subscription (to create the resource group), plus
# Owner or User Access Administrator on it (to assign the deploy role), and
# permission to create Entra app registrations.

. "$PSScriptRoot/config.ps1"

$account = Use-Subscription

Write-Step "Resource group $ResourceGroup ($Location)"
if ((az group exists -n $ResourceGroup) -eq 'true') {
  Write-Ok 'exists'
} else {
  az group create -n $ResourceGroup -l $Location -o none
  Write-Ok 'created'
}

Write-Step "Storage account $StorageAccount"
if (az storage account list -g $ResourceGroup --query "[?name=='$StorageAccount'].name" -o tsv) {
  Write-Ok 'exists'
} else {
  az storage account create -n $StorageAccount -g $ResourceGroup -l $Location `
    --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false -o none
  Write-Ok 'created'
}

Write-Step "Function App $FunctionApp (Flex Consumption, Node $NodeVersion)"
if (az functionapp list -g $ResourceGroup --query "[?name=='$FunctionApp'].name" -o tsv) {
  Write-Ok 'exists'
} else {
  # Also creates an Application Insights resource of the same name.
  az functionapp create -g $ResourceGroup -n $FunctionApp --storage-account $StorageAccount `
    --flexconsumption-location $Location --runtime node --runtime-version $NodeVersion -o none
  Write-Ok 'created'
}

Write-Step 'Function App settings'
# The connection string goes straight from one az call to the next and is never printed.
$connection = az storage account show-connection-string -n $StorageAccount -g $ResourceGroup --query connectionString -o tsv
az functionapp config appsettings set -g $ResourceGroup -n $FunctionApp -o none --settings `
  "AZURE_STORAGE_CONNECTION_STRING=$connection" `
  "ALLOWED_ORIGINS=https://$SiteDomain"
Remove-Variable connection
Write-Ok "AZURE_STORAGE_CONNECTION_STRING set, ALLOWED_ORIGINS=https://$SiteDomain"

Write-Step "Entra app registration '$DeployAppName'"
$appId = Get-DeployAppId
if ($appId) {
  Write-Ok "exists ($appId)"
} else {
  $appId = az ad app create --display-name $DeployAppName --query appId -o tsv
  Write-Ok "created ($appId)"
}

$spId = az ad sp list --filter "appId eq '$appId'" --query '[0].id' -o tsv
if (-not $spId) {
  $spId = az ad sp create --id $appId --query id -o tsv
  Write-Ok 'service principal created'
}

Write-Step 'Website Contributor on the Function App only'
# Deliberately narrow: it can deploy to the Function App and nothing else, not
# even the storage account.
$functionAppId = az functionapp show -g $ResourceGroup -n $FunctionApp --query id -o tsv
$assigned = az role assignment list --assignee $spId --scope $functionAppId --role 'Website Contributor' --query 'length(@)' -o tsv
if ([int]$assigned -gt 0) {
  Write-Ok 'already assigned'
} else {
  az role assignment create --assignee-object-id $spId --assignee-principal-type ServicePrincipal `
    --role 'Website Contributor' --scope $functionAppId -o none
  Write-Ok 'assigned'
}

Write-Step 'OIDC federated credentials (main branch)'
# One for the repo's current name and one for its final name, so deploys keep
# working across the rename in step 7. Step 7 removes the old one.
$existing = az ad app federated-credential list --id $appId --query '[].subject' -o tsv
foreach ($repoName in $OldRepoName, $NewRepoName) {
  $subject = "repo:${Org}/${repoName}:ref:refs/heads/main"
  if ($existing -contains $subject) {
    Write-Ok "exists: $subject"
    continue
  }
  $file = New-TemporaryFile
  @{
    name      = "github-main-$($repoName.ToLower())"
    issuer    = 'https://token.actions.githubusercontent.com'
    subject   = $subject
    audiences = @('api://AzureADTokenExchange')
  } | ConvertTo-Json | Set-Content $file
  az ad app federated-credential create --id $appId --parameters "@$file" -o none
  Remove-Item $file
  Write-Ok "created: $subject"
}

$hostName = Get-FunctionAppHost
Write-Host ''
Write-Host 'Azure is ready.' -ForegroundColor Cyan
Write-Host "    Function App URL : https://$hostName"
Write-Host "    Deploy client ID : $appId"
Write-Host "    Tenant ID        : $($account.tenant)"
Write-Host "    Subscription ID  : $($account.id)"
Write-Host 'Next: .\03-configure-github.ps1'
