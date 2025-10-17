# GitHub Actions Workflows

Overview of automated workflows for cursor-command-publisher.

---

## Publish to NPM and MCP Registry

**File:** `.github/workflows/publish-mcp.yml`

Automates dual publishing to npm and MCP Registry when version tags are pushed.

### Trigger

```yaml
on:
  push:
    tags:
      - "v*"  # v1.0.0, v1.2.3, etc.
  workflow_dispatch:  # Manual trigger
```

### Steps

1. **Checkout** - Gets repository code
2. **Setup Node.js** - Installs Node.js LTS
3. **Install** - Runs `npm ci` for clean install
4. **Build** - Compiles TypeScript via `tsup`
5. **Test** - Executes test suite (`npm test`)
6. **Publish to npm** - Publishes package using `NPM_TOKEN`
7. **Install MCP Publisher** - Downloads MCP publisher CLI
8. **Login to MCP** - Authenticates via GitHub OIDC
9. **Publish to MCP** - Submits `server.json` to registry

### Permissions

```yaml
permissions:
  id-token: write  # Required for OIDC auth with MCP Registry
  contents: read
```

---

## Manual Trigger

From GitHub UI:
1. Go to **Actions** tab
2. Select "Publish to NPM and MCP Registry"
3. Click "Run workflow"
4. Choose branch
5. Click "Run workflow"

---

## Authentication

### npm (Token-Based)

Uses `NPM_TOKEN` repository secret:
```yaml
- name: Publish to npm
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Setup:** [Add NPM_TOKEN to GitHub Secrets](https://github.com/emmahyde/cursor-command-publisher/settings/secrets/actions)

### MCP Registry (OIDC)

Uses GitHub OpenID Connect (no secrets needed):
```yaml
- name: Login to MCP Registry
  run: |
    ./mcp-publisher login github \
      --github-token ${{ secrets.GITHUB_TOKEN }} \
      --github-oidc ${{ secrets.GITHUB_TOKEN }}
```

**How it works:**
- Namespace is `io.github.emmahyde/*` (GitHub-based)
- Workflow runs in your repository context
- GitHub verifies identity to MCP Registry automatically
- No manual token management required

---

## Package Validation

MCP Registry validates npm packages by checking:

1. **Package exists:**
   ```
   https://registry.npmjs.org/cursor-command-publisher
   ```

2. **`mcpName` field present:**
   ```json
   {
     "name": "cursor-command-publisher",
     "mcpName": "io.github.emmahyde/cursor-command-publisher"
   }
   ```

3. **`mcpName` matches `server.json`:**
   ```json
   {
     "name": "io.github.emmahyde/cursor-command-publisher"
   }
   ```

---

## Troubleshooting Workflows

### Workflow Doesn't Run

- GitHub Actions enabled? Settings → Actions → General
- Tag format correct? Must start with `v` (e.g., `v1.0.0`)
- Check repository workflow permissions: "Read and write"

### npm Publish Fails

```
Error: 403 Forbidden
```
- `NPM_TOKEN` secret set correctly?
- Token has publish permissions?
- Package name already taken?

```
Error: Version already exists
```
- Cannot republish same version
- Bump version: `npm version patch`
- Delete tag and try again

### MCP Publish Fails

```
Error: Authentication failed
```
- Verify `id-token: write` permission in workflow ✓
- Check namespace in `server.json`: `io.github.emmahyde/*`

```
Error: Package validation failed
```
- npm publish succeeded first?
- `mcpName` in `package.json` correct?
- Wait a few minutes for npm propagation

### Tests Fail

- Workflow stops if tests fail (by design)
- Fix locally: `npm test`
- Push fixes to trigger re-run

---

## Workflow Files

| File                                | Purpose                     |
| ----------------------------------- | --------------------------- |
| `.github/workflows/publish-mcp.yml` | Dual publishing (npm + MCP) |
| `.github/workflows/test.yml`        | CI test runner              |
| `.github/workflows/publish.yml`     | Legacy npm-only publish     |
| `.github/workflows/release.yml`     | GitHub release automation   |

---

## Version Management

Workflow expects synchronized versions:

| File           | Field                 | Example   |
| -------------- | --------------------- | --------- |
| `package.json` | `version`             | `"1.0.2"` |
| `server.json`  | `version`             | `"1.0.2"` |
| `server.json`  | `packages[0].version` | `"1.0.2"` |
| Git tag        | tag name              | `v1.0.2`  |

**Automation:**
```bash
npm version patch      # Updates package.json + creates tag
# Manually update server.json
git push --follow-tags  # Triggers workflow
```

---

## Monitoring

### View Workflow Runs

https://github.com/emmahyde/cursor-command-publisher/actions

### Check Logs

1. Go to Actions tab
2. Click on workflow run
3. Expand step to view logs
4. Look for errors in red

### Success Indicators

- ✅ Green checkmark on workflow run
- npm package visible: `npm view cursor-command-publisher`
- MCP Registry shows server: `curl "https://registry.modelcontextprotocol.io/v0/servers?search=cursor-command-publisher"`

---

## Resources

- [Publishing Guide](./PUBLISHING.md)
- [Development Guide](./DEVELOPMENT.md)
- [MCP GitHub Actions Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/github-actions.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

