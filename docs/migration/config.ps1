# Shared configuration for every migration script. Each script dot-sources this
# file first, so a name changed here changes everywhere.
#
# Edit the values in the first two blocks. Nothing below the helpers line needs
# changing.

# ─── Target: what everything is called when the migration is done ─────────────

$Org               = 'cse-icon'                  # GitHub organisation
$NewRepoName       = 'products-site'             # GitHub repo name after the final rename
$SiteDomain        = 'products.cse-icon.com'     # Public site host
$Location          = 'southcentralus'            # Azure region for every new resource
$ResourceGroup     = 'cse-products'              # New Azure resource group
$StorageAccount    = 'cseproducts'               # 3-24 lowercase letters/digits, globally unique
$FunctionApp       = 'cse-products-votes'        # Globally unique; becomes <name>.azurewebsites.net
$NodeVersion       = '24'                        # Functions runtime Node version
$DeployAppName     = 'CSE Products GitHub Deploy' # Entra app registration used by GitHub Actions OIDC
$RoadmapAppName    = 'CSE Products Roadmap Sync' # GitHub App display name (renamed by hand, step 6b)
$SubscriptionId    = ''                          # Blank = the subscription `az account show` reports

# DNS. If cse-icon.com is hosted in Azure DNS, set its resource group and the
# DNS scripts make the changes for you. Leave it blank to make them by hand in
# your DNS provider; the scripts then print exactly what to enter.
$DnsZone              = 'cse-icon.com'
$DnsZoneResourceGroup = ''
$PagesTarget          = 'cse-icon.github.io'     # CNAME target for GitHub Pages

# ─── Legacy: what exists today and is removed by the migration ────────────────

$OldRepoName       = 'InterLink-site'
$OldDomain         = 'interlink.products.cse-icon.com'
$OldResourceGroup  = 'InterLink'                 # Deleted whole, with everything in it
# The current deploy app registration is SHARED with other repos (it also holds
# a federated credential for cse-icon/Canary-gRPC-documentation), so step 6 only
# removes this repo's credential from it and never deletes the app.
$OldDeployAppName  = 'GitHub Deploy'

# ─── Helpers. No need to edit below this line. ────────────────────────────────

#Requires -Version 7.3
$ErrorActionPreference = 'Stop'
# Make a failing az/gh/git call stop the script, like a failing cmdlet.
$PSNativeCommandUseErrorActionPreference = $true

# The repo is renamed last, so every script before step 7 talks to the old name.
$CurrentRepo = "$Org/$OldRepoName"
$FinalRepo   = "$Org/$NewRepoName"

function Get-RecordName([string] $fqdn) {
  # 'products.cse-icon.com' in zone 'cse-icon.com' -> 'products'
  $fqdn.Substring(0, $fqdn.Length - $DnsZone.Length - 1)
}

function Write-Step([string] $message) {
  Write-Host ''
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Ok([string] $message) { Write-Host "    ok  $message" -ForegroundColor Green }
function Write-Note([string] $message) { Write-Host "    ..  $message" -ForegroundColor Yellow }

function Confirm-OrExit([string] $expected, [string] $prompt) {
  $answer = Read-Host "$prompt (type '$expected' to continue)"
  if ($answer -ne $expected) {
    Write-Host 'Cancelled. Nothing further was changed.' -ForegroundColor Yellow
    exit 1
  }
}

function Use-Subscription {
  if ($SubscriptionId) { az account set --subscription $SubscriptionId | Out-Null }
  $account = az account show --query '{id:id, name:name, tenant:tenantId}' -o json | ConvertFrom-Json
  Write-Note "Azure subscription: $($account.name) ($($account.id))"
  return $account
}

# Values derived from Azure, so each script works from config alone with no
# state carried between runs.
function Get-DeployAppId {
  param([string] $displayName = $DeployAppName)
  az ad app list --display-name $displayName --query '[0].appId' -o tsv
}

function Get-FunctionAppHost {
  az functionapp show -g $ResourceGroup -n $FunctionApp --query defaultHostName -o tsv
}
