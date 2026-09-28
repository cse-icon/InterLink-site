# Step 7: rename the GitHub repo, the last step.
#
# GitHub redirects the old repo URL (web and git) to the new one, keeps the Pages
# custom domain, variables, secrets and environments, and starts putting the new
# name in the OIDC token subject. Step 2 already created a federated credential
# for that subject, so deploys keep working. This script then removes the
# credential for the old name and proves a deploy still authenticates.
#
# Run it from inside your local clone so it can update the git remote.

. "$PSScriptRoot/config.ps1"

Use-Subscription | Out-Null
$appId = Get-DeployAppId
$newSubject = "repo:${Org}/${NewRepoName}:ref:refs/heads/main"
$oldSubject = "repo:${Org}/${OldRepoName}:ref:refs/heads/main"

$subjects = az ad app federated-credential list --id $appId --query '[].subject' -o tsv
if ($subjects -notcontains $newSubject) { throw "No federated credential for $newSubject. Re-run 02-create-azure.ps1." }

Write-Step "Renaming $CurrentRepo -> $FinalRepo"
Confirm-OrExit $NewRepoName 'Rename the repo?'
gh repo rename $NewRepoName --repo $CurrentRepo --yes
Write-Ok 'renamed'

Write-Step 'Updating the local git remote'
$remote = git remote get-url origin
$updated = $remote -replace [regex]::Escape("$Org/$OldRepoName"), "$Org/$NewRepoName"
git remote set-url origin $updated
Write-Ok "origin = $updated"

Write-Step 'Proving deploys authenticate under the new name'
gh workflow run deploy-functions.yml --repo $FinalRepo --ref main
Start-Sleep -Seconds 5
$runId = gh run list --repo $FinalRepo --workflow deploy-functions.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $runId --repo $FinalRepo --exit-status
Write-Ok 'Deploy Azure Functions succeeded'

Write-Step "Removing the federated credential for $oldSubject"
$oldCredentialId = az ad app federated-credential list --id $appId --query "[?subject=='$oldSubject'].id | [0]" -o tsv
if ($oldCredentialId) {
  az ad app federated-credential delete --id $appId --federated-credential-id $oldCredentialId
  Write-Ok 'deleted'
} else {
  Write-Ok 'already gone'
}

Write-Host ''
Write-Host "Done. The repo is $FinalRepo." -ForegroundColor Cyan
Write-Host 'Last: rename your local folder if you like, then delete docs/migration/ in a final commit (README.md, step 7b).'
