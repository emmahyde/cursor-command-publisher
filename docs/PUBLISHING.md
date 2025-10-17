# Publishing Guide

Complete guide for publishing cursor-command-publisher to npm and the MCP Registry.

## Quick Start

**Prerequisites:** Add `NPM_TOKEN` to [GitHub Secrets](https://github.com/emmahyde/cursor-command-publisher/settings/secrets/actions)

```bash
# 1. Bump version
npm version patch  # or minor, or major

# 2. Update server.json versions manually (see below)

# 3. Push with tag
git push --follow-tags
```

**Result:** GitHub Actions automatically publishes to npm → MCP Registry

---

## Initial Setup (One-Time)

### 1. Create NPM Token

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Generate "Automation" token
3. Copy the token

### 2. Add to GitHub Secrets

1. Navigate to: https://github.com/emmahyde/cursor-command-publisher/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: (paste token)
5. Click "Add secret"

### 3. Verify Repository Settings

- GitHub Actions enabled: Settings → Actions → General
- Workflow permissions: "Read and write permissions"

---

## Publishing Process

### Version Update

```bash
# Bump version (updates package.json + creates git tag)
npm version patch  # 1.0.1 → 1.0.2
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.0.1 → 2.0.0
```

### Sync server.json Versions

⚠️ **Manual step:** Update `server.json` to match `package.json` version:

```json
{
  "version": "1.0.2",  // ← Update this
  "packages": [
    {
      "version": "1.0.2"  // ← And this
    }
  ]
}
```

### Push Changes

```bash
git push --follow-tags
```

### Monitor Workflow

1. Go to [GitHub Actions](https://github.com/emmahyde/cursor-command-publisher/actions)
2. Watch "Publish to NPM and MCP Registry" workflow
3. Check for success ✅

---

## Verification

### Check npm

```bash
npm view cursor-command-publisher
```

### Check MCP Registry

```bash
curl "https://registry.modelcontextprotocol.io/v0/servers?search=cursor-command-publisher"
```

Or visit: https://registry.modelcontextprotocol.io/

---

## How It Works

### Workflow Trigger

- **Automatic:** Pushing a tag starting with `v` (e.g., `v1.0.2`)
- **Manual:** Actions tab → "Publish to NPM and MCP Registry" → "Run workflow"

### Authentication

**npm:**
- Uses `NPM_TOKEN` secret
- Standard token-based auth

**MCP Registry:**
- Uses GitHub OIDC (OpenID Connect)
- **No secrets needed!**
- Auto-verified via `io.github.emmahyde/*` namespace
- Workflow has `id-token: write` permission

### Package Validation

MCP Registry validates:
1. Package exists on npm: `cursor-command-publisher`
2. `package.json` contains `mcpName` field ✓
3. `mcpName` matches `server.json` name ✓

---

## Troubleshooting

### Build Fails

```bash
# Check tsup is installed
npm list tsup

# Clean and rebuild
rm -rf build && npm run build
```

### Tests Fail

```bash
# Run tests locally
npm test

# Run specific test file
npm test -- tests/parser.test.ts
```

### NPM Publish Fails

**Error: 403 Forbidden**
- Verify `NPM_TOKEN` secret is set correctly
- Check token has publish permissions
- Ensure you own the package name

**Error: Version already exists**
- Cannot republish same version
- Increment version: `npm version patch`
- Delete git tag if needed:
  ```bash
  git tag -d v1.0.1
  git push origin :refs/tags/v1.0.1
  ```

### MCP Registry Fails

**Error: Package validation failed**
- Ensure npm publish succeeded first
- Verify `mcpName` in `package.json` matches `server.json` name
- Wait a few minutes for npm to propagate

**Error: Authentication failed**
- Verify `id-token: write` permission in workflow (already set)
- Check namespace in `server.json`: `io.github.emmahyde/*`

**Error: Transport validation failed**
- Transport must be object: `{"type": "stdio"}` (already fixed)

---

## Version Synchronization

Keep these in sync:
- `package.json` → `"version": "X.Y.Z"`
- `server.json` → `"version": "X.Y.Z"`
- `server.json` → `"packages[0].version": "X.Y.Z"`
- Git tag → `vX.Y.Z`

💡 **Tip:** `npm version` automates `package.json` + git tag, but you must manually update `server.json`.

---

## Resources

### Documentation
- [Architecture & Development](./DEVELOPMENT.md)
- [GitHub Actions Workflow](./WORKFLOWS.md)
- [Main README](../README.md)

### External Links
- [MCP Registry](https://github.com/modelcontextprotocol/registry)
- [Publishing Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md)
- [GitHub Actions Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/github-actions.md)
- [tsup Documentation](https://tsup.egoist.dev/)

---

**Questions?** Check the [MCP Registry docs](https://github.com/modelcontextprotocol/registry) or workflow logs in GitHub Actions.

