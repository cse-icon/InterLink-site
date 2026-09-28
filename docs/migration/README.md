# Migration: InterLink site → CSE ICON products site

The code on `main` after PR #1 is written for the end state: one site at
`products.cse-icon.com` serving every product, backed by new Azure resources.
This guide moves the live infrastructure there from what exists today. Each step
is a script, except for the few that can only be done by hand.

**Nothing is preserved.** The old vote data isn't real, so this builds new
resources and deletes the old ones instead of renaming anything. Expect the
roadmap's voting to be down for the hour or so between steps 3 and 4. Nobody
will notice.

Delete this folder in the final commit (step 7b). It is the only place the old
names should appear.

## What changes

| | Today | After |
|---|---|---|
| Site host | `interlink.products.cse-icon.com` | `products.cse-icon.com` (InterLink at `/interlink`) |
| Old host | serves the site | **gone**, with its DNS record deleted |
| GitHub repo | `cse-icon/InterLink-site` | `cse-icon/products-site` |
| Resource group | `InterLink` | `Products` |
| Function App | `cse-interlink-votes` | `cse-products-votes` |
| Storage account | `cseinterlink` | `cseproducts` |
| App Service plan, App Insights | `ASP-InterLink-87cc`, `cse-interlink` | created by the Flex Consumption app |
| Deploy identity | Entra app `GitHub Deploy` (shared by the org's repos): Website Contributor on the `InterLink` resource group, credential for `InterLink-site` | Same app: Website Contributor on the new Function App, credential for `products-site` |
| CORS setting | `SITE_URL` | `ALLOWED_ORIGINS` (comma-separated list) |
| Function App name in CI | hard-coded in the workflow | repo variable `AZURE_FUNCTIONAPP_NAME` |
| Roadmap sync GitHub App | `InterLink Roadmap Sync` | `CSE Products Roadmap Sync` (renamed; same ID and key) |
| Unused repo variables | `PROJECT_NUMBER`, `APP_INSTALLATION_ID` | deleted |

Every name above comes from **[config.ps1](config.ps1)**. Change it there
before you start and every script follows.

## Before you start

- **PowerShell 7.3+**, **Azure CLI**, and **GitHub CLI**, signed in:
  `az login` and `gh auth login`.
- On the Azure subscription: **Owner** (or Contributor plus User Access
  Administrator), and owner of the `GitHub Deploy` app registration.
- **Admin** on `cse-icon/InterLink-site`, and org owner on `cse-icon` for step 6b.
- Access to **GoDaddy**, which hosts `cse-icon.com` DNS. Steps 1 and 6 tell you
  what to change and you make the change by hand.

Run every script from this folder:

```powershell
cd docs/migration
```

## Step 0: preflight (read-only)

```powershell
.\00-preflight.ps1
```

Shows the current Pages domain, Actions variables, the deploy app's federated
credentials and role assignments, old and new resource groups, storage name
availability, and DNS. Fix
anything printed in red before moving on. Run it again at any point to see where
you are.

## Step 1: DNS for the new host

```powershell
.\01-add-dns.ps1
```

It prints the record to add. In GoDaddy, open **My Products → cse-icon.com →
DNS**, click **Add New Record**, and add:

| Type | Name | Value | TTL |
|---|---|---|---|
| CNAME | `products` | `cse-icon.github.io` | 1 hour |

Re-run the script until it reports the record resolves (usually 5–30 minutes).
This is safe to do at any time, because nothing serves on the new host until
step 4.

**Recommended, once:** verify the domain for the org so no other GitHub account
can ever claim a `cse-icon.com` subdomain on Pages. Go to **github.com →
cse-icon org → Settings → Pages → Add a domain**, enter `cse-icon.com`, add
the TXT record it shows you in GoDaddy, then click **Verify**. Skip this if
`cse-icon.com` is already listed there as verified.

## Step 2: create the new Azure resources

```powershell
.\02-create-azure.ps1
```

This creates the resource group, the storage account (TLS 1.2 minimum, no public
blob access), the Flex Consumption Function App on Node 24, and its app settings
(`AZURE_STORAGE_CONNECTION_STRING`, `ALLOWED_ORIGINS`). The connection string is
never printed.

It then gives the existing, shared `GitHub Deploy` app registration what it needs
for the new resources:

- **Website Contributor on the new Function App.** Its current assignment is on
  the `InterLink` resource group and goes with it in step 6. It's scoped to the
  Function App rather than the `Products` resource group because the app is
  shared: every repo that deploys with it gets these rights, and this limits them
  to deploying the Function App.
- **A federated credential for `products-site`**, added alongside the existing
  `InterLink-site` one, so deploys keep working the moment the repo is renamed.
  Step 7 removes the old one after the rename.

`AZURE_CLIENT_ID` doesn't change.

It's idempotent, so re-run it after any failure.

## Step 3: point GitHub at Azure

```powershell
.\03-configure-github.ps1
```

This sets `AZURE_FUNCTIONAPP_NAME` and `PUBLIC_VOTE_API_URL`, and deletes the
variables nothing reads any more. `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, `APP_ID` and the `APP_PRIVATE_KEY` secret stay as they
are.

## Step 3b: merge and deploy (by hand)

```powershell
gh pr merge 1 --repo cse-icon/InterLink-site --merge
gh run list --repo cse-icon/InterLink-site --limit 4
gh run watch --repo cse-icon/InterLink-site   # pick each run in turn
```

The merge triggers **Deploy Azure Functions** (to the new app) and **Deploy
Site**. If either didn't start, run it by hand:

```powershell
gh workflow run deploy-functions.yml --repo cse-icon/InterLink-site
gh workflow run deploy-site.yml --repo cse-icon/InterLink-site
```

The site is still on the old host at this point, and voting there fails with a
CORS error because the new API only allows the new host. That's expected.

## Step 4: move the site to the new host

```powershell
.\04-switch-domain.ps1
```

This sets the Pages custom domain through the API, waits for GitHub to issue the
TLS certificate, then enforces HTTPS. From here the old host no longer serves the
site. Pages allows one custom domain per repo, and it deploys with
`actions/deploy-pages`, which ignores `CNAME` files. That's why the repo no
longer has one.

## Step 5: verify

```powershell
.\05-verify.ps1
```

This is read-only. It checks the pages load over HTTPS, that the roadmap bundle
calls the new API, that the API answers, and that CORS allows the site and
refuses other origins. Then cast one real vote on
<https://products.cse-icon.com/interlink/roadmap> to prove writes work. Look it
up afterwards under the storage account → **Storage browser → Tables →
votes**.

## Step 6: remove the old infrastructure

```powershell
.\06-remove-old.ps1
```

The script refuses to run until the new setup is live. It then lists what it will
delete and asks you to type the resource group name.

1. **The `interlink.products` CNAME.** It pauses while you delete it in GoDaddy.
   Don't skip this: a CNAME to `github.io` that no repo claims can be taken over
   by anyone's Pages site.
2. **The `InterLink` resource group**, with the Function App, storage account,
   App Service plan, App Insights, and its alert rule. The `GitHub Deploy` role
   assignment on it goes too.

The `GitHub Deploy` app registration itself isn't touched.

## Step 6b: rename the roadmap GitHub App (by hand)

1. **github.com → cse-icon org → Settings → Developer settings → GitHub Apps**
   → the roadmap sync app. The old README calls it **InterLink Roadmap Sync**.
   Confirm it by matching its App ID to `gh variable get APP_ID --repo
   cse-icon/InterLink-site`. Then click **Edit**.
2. **GitHub App name:** `CSE Products Roadmap Sync`.
3. **Homepage URL:** `https://products.cse-icon.com`.
4. **Save changes.**

The App ID, private key and installation don't change, so `APP_ID` and
`APP_PRIVATE_KEY` stay valid. To prove it, run the sync:

```powershell
gh workflow run sync-roadmap.yml --repo cse-icon/InterLink-site
```

## Step 7: rename the repo (last)

```powershell
.\07-rename-repo.ps1
```

Run it from inside your clone. It renames the repo to `products-site` and
updates your `origin` remote. Then it runs **Deploy Azure Functions** to prove
OIDC works under the new name, and removes the `InterLink-site` federated
credential from `GitHub Deploy`. GitHub redirects the old repo URL, and keeps the Pages domain, variables,
secrets and environments.

## Step 7b: tidy up (by hand)

1. **Anyone else with a clone** runs:
   `git remote set-url origin https://github.com/cse-icon/products-site.git`
2. **Optionally rename your local folder** to `products-site` (close VS Code
   first).
3. **Delete this folder** in a final commit:

   ```powershell
   git rm -r docs/migration
   git commit -m "docs: remove completed migration guide"
   git push
   ```

## If something goes wrong

| Symptom | Fix |
|---|---|
| Step 2: `The storage account named ... is already taken` | Change `$StorageAccount` in config.ps1 (globally unique) and re-run |
| Step 2: `runtime version 24 is not supported` | Set `$NodeVersion = '22'` in config.ps1 and re-run |
| Step 3b: Functions deploy `401` / `AADSTS70021` | The `InterLink-site` federated credential is missing from `GitHub Deploy`. Check with `az ad app federated-credential list --id <AZURE_CLIENT_ID>` |
| Step 3b: Functions deploy `403` / authorization failed | The role assignment on the new Function App is missing or still propagating. Re-run step 2, wait a few minutes, re-run the workflow |
| Step 4: certificate stuck or `errored` | Check **Settings → Pages**. Remove and re-add the domain there, then re-run step 4 |
| Step 5: page doesn't reference the new API | `PUBLIC_VOTE_API_URL` is baked in at build time. Re-run **Deploy Site** after step 3 |
| Votes fail with CORS after step 4 | `az functionapp config appsettings list -g Products -n cse-products-votes --query "[?name=='ALLOWED_ORIGINS']"` must be `https://products.cse-icon.com` |
| Step 7: deploy fails after the rename | Re-run step 2 (it adds the credential for the new name if it's missing), then re-run the workflow |
