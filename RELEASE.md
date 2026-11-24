# Release procedure

## First publication

Use an authenticated developer machine with Node.js 22+ and network access to the public npm registry. Never disclose credentials or commit an `.npmrc`.

1. Run `npm whoami --registry=https://registry.npmjs.org/` and `npm view n8n-nodes-cloudtips version --registry=https://registry.npmjs.org/`. Only E404 means the package was not found; a network error does not verify authentication or name availability.
2. Run `npm ci --ignore-scripts`, `npm test` once, and `npm pack --dry-run`. Commit any release changes, including `package-lock.json`.
3. Run `npm publish --access public --registry=https://registry.npmjs.org/` with your account and MFA if requested.
4. Verify `npm view n8n-nodes-cloudtips@0.1.0 version dist.integrity --registry=https://registry.npmjs.org/` and download the published archive with `npm pack n8n-nodes-cloudtips@0.1.0 --registry=https://registry.npmjs.org/` in a temporary directory.
5. Push the release commit, create and push tag `v0.1.0`, and create the GitHub Release. Include the experimental status and validation limits below in the release notes.

## Trusted Publishing for subsequent versions

The repository's `.github/workflows/publish.yml` uses a GitHub-hosted runner, Node.js 24 (with npm 11.5.1 or later), and `id-token: write`. It runs only when manually dispatched on `main`, uses the committed lockfile, tests and previews the archive before publishing, and prevents concurrent publications. No `NPM_TOKEN` or `NODE_AUTH_TOKEN` secret is needed.

After the first publication, configure a trusted publisher in the [npm package settings](https://www.npmjs.com/package/n8n-nodes-cloudtips/access):

| Setting | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `Lfyz-git` |
| Repository | `n8n-nodes-cloudtips` |
| Workflow filename | `publish.yml` |
| Environment | Leave empty |
| Allowed actions | Enable direct publishing with `npm publish` |

The workflow alone does not activate the trust relationship. According to the [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/), a new configuration must complete its first successful publication within two days; create it when the next version is ready. OIDC publications of a public package from a public repository automatically include provenance.

For each subsequent release, update the package version and lockfile together, commit and push to `main`, then dispatch **Publish to npm**. Verify the published version and provenance before tagging that commit and creating its GitHub Release. Do not attempt to republish an existing version.

This is an experimental release. Test live n8n loading and CloudTips events before claiming runtime compatibility.
