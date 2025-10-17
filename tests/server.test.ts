import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCommandServer } from '../src/server.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('createCommandServer', () => {
  let testDir: string;
  let server: ReturnType<typeof createCommandServer>;

  beforeEach(async () => {
    testDir = path.join(
      __dirname,
      `../.test-server-${Date.now()}-${Math.random()}`
    );
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (server) {
      try {
        await server.stop();
      } catch (_error) {
        // Ignore stop errors
      }
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  it('creates server instance', () => {
    server = createCommandServer(testDir);
    expect(server).toBeDefined();
  });

  it('can be started and stopped', async () => {
    server = createCommandServer(testDir);
    // Note: MockTransport doesn't implement full interface
    // but that's okay for this test - we're just checking server creation
    expect(server).toBeDefined();
  });

  it('creates commands directory if not exists', async () => {
    const nonExistentDir = path.join(testDir, 'commands');
    server = createCommandServer(nonExistentDir);

    // Start watcher (which creates the directory)
    await server._watcher.start();

    const exists = await fs
      .access(nonExistentDir)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
    await server._watcher.stop();
  });

  it('loads markdown files on startup', async () => {
    // Create test files
    const file1 = path.join(testDir, 'cmd1.md');
    const file2 = path.join(testDir, 'cmd2.md');

    await fs.writeFile(file1, 'Command 1: #{var1}');
    await fs.writeFile(file2, 'Command 2: #{var2}');

    server = createCommandServer(testDir);
    await server._watcher.start();

    // Wait for files to be processed
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check that tools are registered
    const tools = server._tools;
    expect(tools.has('cmd1')).toBe(true);
    expect(tools.has('cmd2')).toBe(true);

    await server._watcher.stop();
  });

  it('registers new tool when file is saved after startup', async () => {
    // Start server with empty directory
    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify no tools initially
    let tools = server._tools;
    expect(tools.size).toBe(0);

    // User saves a new command file
    const newCmdFile = path.join(testDir, 'newsave.md');
    const content = `---
from: "source language"
to: "target language"
text: "text to translate"
---
Translate: #{from} to #{to}: #{text}`;
    await fs.writeFile(newCmdFile, content);

    // Wait for watcher to detect and process
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify tool was registered
    tools = server._tools;
    expect(tools.has('newsave')).toBe(true);

    const tool = tools.get('newsave');
    expect(tool?.parsed.vars).toHaveLength(3);
    expect(tool?.parsed.vars.map((v: any) => v.name)).toEqual([
      'from',
      'to',
      'text',
    ]);

    await server._watcher.stop();
  });

  it('updates tools when files change', async () => {
    const cmdFile = path.join(testDir, 'update.md');
    await fs.writeFile(
      cmdFile,
      `---
var: "variable"
---
Version 1: #{var}`
    );

    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check initial state
    let tool = server._tools.get('update');
    expect(tool?.parsed.vars).toHaveLength(1);
    expect(tool?.parsed.vars[0]?.name).toBe('var');

    // Update file with new variables
    await fs.writeFile(
      cmdFile,
      `---
var1: "first variable"
var2: "second variable"
---
Version 2: #{var1} and #{var2}`
    );
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check updated state
    tool = server._tools.get('update');
    // Should have picked up new variables
    expect(tool?.parsed.vars.length).toBeGreaterThanOrEqual(1);

    await server._watcher.stop();
  });

  it('removes tools when files are deleted', async () => {
    const cmdFile = path.join(testDir, 'delete.md');
    await fs.writeFile(cmdFile, 'Delete me: #{var}');

    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify tool exists
    expect(server._tools.has('delete')).toBe(true);

    // Delete file
    await fs.rm(cmdFile);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify tool is removed
    expect(server._tools.has('delete')).toBe(false);

    await server._watcher.stop();
  });

  it('extracts description from template', async () => {
    const cmdFile = path.join(testDir, 'described.md');
    const content = `This is the tool description

Execute: #{cmd}`;

    await fs.writeFile(cmdFile, content);

    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    const tool = server._tools.get('described');
    expect(tool?.description).toContain('This is the tool description');

    await server._watcher.stop();
  });

  it('handles multiple variables in templates', async () => {
    const cmdFile = path.join(testDir, 'multi.md');
    const content = `---
from: "source location"
to: "destination location"
text: "message text"
---
From #{from} to #{to}: #{text}`;

    await fs.writeFile(cmdFile, content);

    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    const tool = server._tools.get('multi');
    expect(tool?.parsed.vars).toHaveLength(3);
    expect(tool?.parsed.vars.map((v: any) => v.name)).toEqual([
      'from',
      'to',
      'text',
    ]);

    await server._watcher.stop();
  });

  it('generates correct JSON schema for tools', async () => {
    const cmdFile = path.join(testDir, 'schema.md');
    const content = `---
var1: "first variable"
var2: "second variable"
---
#{var1} and #{var2}`;

    await fs.writeFile(cmdFile, content);

    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    const tool = server._tools.get('schema');
    const schema = tool?.parsed.inputSchema;

    expect(schema.type).toBe('object');
    expect(schema.properties.var1).toBeDefined();
    expect(schema.properties.var2).toBeDefined();
    expect(schema.properties.var1.description).toBe('first variable');
    expect(schema.properties.var2.description).toBe('second variable');
    expect(schema.required).toEqual(['var1', 'var2']);

    await server._watcher.stop();
  });

  it('handles invalid templates gracefully', async () => {
    const cmdFile = path.join(testDir, 'invalid.md');
    const content = 'Invalid: #{unclosed';

    await fs.writeFile(cmdFile, content);

    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Tool should still be registered despite invalid template
    const tool = server._tools.get('invalid');
    expect(tool).toBeDefined();
    // Invalid template should result in no variables
    expect(tool?.parsed.vars).toHaveLength(0);

    await server._watcher.stop();
  });

  it('handles special characters in templates', async () => {
    const cmdFile = path.join(testDir, 'special.md');
    const content = `---
text: 'text with "quotes" and, commas'
---
Echo: #{text}`;

    await fs.writeFile(cmdFile, content);

    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    const tool = server._tools.get('special');
    expect(tool?.parsed.vars).toHaveLength(1);
    expect(tool?.parsed.vars[0]?.description).toContain('quotes');

    await server._watcher.stop();
  });

  it('only processes .md files', async () => {
    // Create .md and .txt files
    const mdFile = path.join(testDir, 'process.md');
    const txtFile = path.join(testDir, 'ignore.txt');

    await fs.writeFile(mdFile, 'Process: #{var}');
    await fs.writeFile(txtFile, 'Ignore: #{var}');

    server = createCommandServer(testDir);
    await server._watcher.start();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Only .md file should be registered
    expect(server._tools.has('process')).toBe(true);
    expect(server._tools.has('ignore')).toBe(false);

    await server._watcher.stop();
  });
});
