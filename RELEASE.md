# Release procedure

First release: on an authenticated developer machine with Node.js 22+ and npm, run npm view n8n-nodes-cloudtips version to check the name (only E404 indicates it is not found). Run npm install --package-lock-only --ignore-scripts, npm ci --ignore-scripts, npm test, npm pack --dry-run. Commit package-lock.json. Use npm login and npm publish --access public with your own account and MFA. Never disclose credentials.

Configure npm Trusted Publishing on the package settings page: GitHub Actions, owner Lfyz-git, repository n8n-nodes-cloudtips, workflow publish.yml, no environment. Subsequent releases: bump version and update lockfile, push, dispatch Publish to npm. Do not store permanent tokens.

This is an experimental release. Test live n8n loading and CloudTips events before claiming runtime compatibility.
