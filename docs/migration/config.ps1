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
$ResourceGroup     = 'Products'                  # New Azure resource group
$StorageAccount    = 'cseproducts'               # 3-24 lowercase letters/digits, globally unique
$FunctionApp       = 'cse-products-votes'        # Globally unique; becomes <name>.azurewebsites.net
$NodeVersion       = '24'                        # Functions runtime Node version
$RoadmapAppName    = 'CSE Products Roadmap Sync' # GitHub App display name (renamed by hand, step 6b)
$SubscriptionId    = ''  # Blank = the subscription `az account show` reports

# Existing Entra app registration the org's repos share for GitHub -> Azure OIDC
# deploys. It is kept; the migration only changes this repo's pieces on it: a
# role assignment on the new Function App, and one federated credential per
# repo name.
$DeployAppName     = 'GitHub Deploy'

# DNS is at GoDaddy and is changed by hand; the scripts print what to enter.
$DnsZone           = 'cse-icon.com'
$PagesTarget       = 'cse-icon.github.io'        # CNAME target for GitHub Pages

# ─── Legacy: what exists today and is removed by the migration ────────────────

$OldRepoName       = 'InterLink-site'
$OldDomain         = 'interlink.products.cse-icon.com'
$OldResourceGroup  = 'InterLink'                 # Deleted whole, with everything in it

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
  $appId = az ad app list --display-name $DeployAppName --query '[0].appId' -o tsv
  if (-not $appId) { throw "No Entra app registration named '$DeployAppName'. Check `$DeployAppName in config.ps1." }
  $appId
}

function Get-CredentialSubject([string] $repoName) {
  "repo:${Org}/${repoName}:ref:refs/heads/main"
}

function Get-FunctionAppHost {
  # `az functionapp show` puts defaultHostName at the top level in some CLI
  # versions and under `properties` in others; the generic resource is stable.
  az resource show -g $ResourceGroup -n $FunctionApp --resource-type Microsoft.Web/sites `
    --query properties.defaultHostName -o tsv
}
