# Step 0: read-only checks. Changes nothing. Run it first, and again whenever
# you want to see where things stand.

. "$PSScriptRoot/config.ps1"

Write-Step 'Tools'
foreach ($tool in 'az', 'gh', 'git') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed or not on PATH" }
  Write-Ok $tool
}

Write-Step 'Sign-ins'
gh auth status
$account = Use-Subscription

Write-Step "GitHub repo $CurrentRepo"
gh repo view $CurrentRepo --json nameWithOwner,visibility,defaultBranchRef --jq '"    \(.nameWithOwner) (\(.visibility)), default branch \(.defaultBranchRef.name)"'
$pages = gh api "repos/$CurrentRepo/pages" | ConvertFrom-Json
Write-Note "Pages custom domain: $($pages.cname)   build: $($pages.build_type)   https enforced: $($pages.https_enforced)"
Write-Note 'Actions variables:'
gh variable list --repo $CurrentRepo

Write-Step "Deploy app registration '$DeployAppName'"
$appId = Get-DeployAppId
$currentClientId = try { gh variable get AZURE_CLIENT_ID --repo $CurrentRepo 2>$null } catch { '' }
if ($currentClientId -eq $appId) {
  Write-Ok "AZURE_CLIENT_ID matches ($appId)"
} else {
  Write-Host "    !!  AZURE_CLIENT_ID is '$currentClientId', not '$DeployAppName' ($appId). Check `$DeployAppName in config.ps1." -ForegroundColor Red
}
Write-Note 'Federated credentials:'
az ad app federated-credential list --id $appId --query '[].subject' -o tsv |
  ForEach-Object { Write-Host "            $_" }
$spId = az ad sp list --filter "appId eq '$appId'" --query '[0].id' -o tsv
Write-Note 'Role assignments:'
az role assignment list --assignee $spId --all --query '[].{role:roleDefinitionName, scope:scope}' -o table

Write-Step "Legacy Azure resource group $OldResourceGroup (deleted in step 6)"
if ((az group exists -n $OldResourceGroup) -eq 'true') {
  az resource list -g $OldResourceGroup --query '[].{name:name, type:type}' -o table
} else {
  Write-Ok 'already gone'
}

Write-Step "Target Azure resource group $ResourceGroup"
if ((az group exists -n $ResourceGroup) -eq 'true') {
  az resource list -g $ResourceGroup --query '[].{name:name, type:type}' -o table
} else {
  Write-Note 'does not exist yet (created in step 2)'
  $storage = az storage account check-name --name $StorageAccount -o json | ConvertFrom-Json
  if ($storage.nameAvailable) {
    Write-Ok "storage account name '$StorageAccount' is available"
  } else {
    Write-Host "    !!  storage account name '$StorageAccount' is taken: $($storage.message) Change `$StorageAccount in config.ps1." -ForegroundColor Red
  }
}

Write-Step 'DNS'
foreach ($name in $SiteDomain, $OldDomain) {
  $record = Resolve-DnsName $name -Type CNAME -DnsOnly -ErrorAction SilentlyContinue |
    Where-Object { $_.Type -eq 'CNAME' } | Select-Object -First 1
  if ($record) { Write-Note "$name -> $($record.NameHost)" } else { Write-Note "$name has no CNAME record" }
}

Write-Host ''
Write-Host "Preflight done for tenant $($account.tenant)." -ForegroundColor Cyan
