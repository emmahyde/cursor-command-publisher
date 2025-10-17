# GitHub Actions Workflows

## Publish to NPM and MCP Registry

### Overview
The `publish-mcp.yml` workflow automates publishing your package to both npm and the MCP Registry. It runs whenever you push a version tag (like `v1.0.0`).

### Setup Instructions

#### 1. Configure NPM Token

1. Create an NPM access token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" token type
   - Copy the token

2. Add the token to GitHub Secrets:
   - Go to your repository on GitHub
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your NPM token
   - Click "Add secret"

#### 2. No Additional Setup Required for MCP Registry

The workflow uses GitHub OIDC (OpenID Connect) to authenticate with the MCP Registry automatically. No secrets needed!

The OIDC authentication works because:
- Your `server.json` uses the `io.github.emmahyde/*` namespace
- The workflow has `id-token: write` permission
- The action runs in your repository's context

### Usage

#### Trigger Publishing with a Version Tag

```bash
# Update version in package.json and server.json first
npm version patch  # or minor, or major

# Push the tag to GitHub
git push origin v1.0.2  # Replace with your version
```

Or manually create and push a tag:

```bash
git tag v1.0.2
git push origin v1.0.2
```

#### Manual Trigger

You can also manually trigger the workflow from the GitHub Actions tab:
1. Go to Actions → Publish to NPM and MCP Registry
2. Click "Run workflow"
3. Select your branch
4. Click "Run workflow"

### What the Workflow Does

1. **Checkout code** - Gets your repository code
2. **Setup Node.js** - Installs Node.js LTS version
3. **Install dependencies** - Runs `npm ci` for clean install
4. **Run tests** - Executes `npm test` to ensure quality
5. **Build package** - Runs `npm run build` to compile TypeScript
6. **Publish to npm** - Publishes the package to npm registry
7. **Install MCP Publisher** - Downloads the latest MCP publisher CLI
8. **Login to MCP Registry** - Authenticates using GitHub OIDC
9. **Publish to MCP Registry** - Submits your server.json to the MCP Registry

### Package Validation

For npm packages to be accepted by the MCP Registry, your `package.json` must include the `mcpName` field:

```json
{
  "name": "cursor-command-publisher",
  "mcpName": "io.github.emmahyde/cursor-command-publisher"
}
```

This is already configured in your `package.json`.

### Troubleshooting

**"Authentication failed"**
- Ensure the `id-token: write` permission is set in the workflow (already configured)
- Verify your `server.json` uses the correct namespace: `io.github.emmahyde/*`

**"Package validation failed"**
- Verify the `mcpName` field in `package.json` matches the `name` in `server.json`
- Ensure the package published to npm successfully before the MCP publish step
- Check that the npm package name in `server.json` matches your actual npm package

**"NPM publish failed"**
- Verify your `NPM_TOKEN` secret is correctly set
- Ensure the token has publish permissions
- Check that you're not trying to publish a version that already exists

**Tests failing**
- The workflow will stop if tests fail
- Fix the tests locally and push again
- Or use `continue-on-error: true` in the test step (not recommended)

### Version Synchronization

The workflow expects version numbers to match across:
- `package.json` → `"version": "1.0.1"`
- `server.json` → `"version": "1.0.1"`
- Git tag → `v1.0.1`

Tip: Use `npm version` command to update both `package.json` and create the git tag automatically:

```bash
npm version patch  # Updates package.json and creates tag
git push --follow-tags  # Pushes code and tags together
```

### References

- [MCP Registry Publishing Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md)
- [MCP Registry GitHub Actions Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/github-actions.md)
- [NPM Publishing Docs](https://docs.npmjs.com/cli/v10/commands/npm-publish)

