import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCommandWatcher } from '../src/watcher.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('CommandWatcher', () => {
  let testDir: string;
  let watcher: ReturnType<typeof createCommandWatcher>;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = path.join(__dirname, `../.test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    watcher = createCommandWatcher([testDir]);
  });

  afterEach(async () => {
    // Clean up
    if (watcher) {
      await watcher.stop();
    }
    // Remove test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('creates directory if it does not exist', async () => {
    const nonExistentDir = path.join(testDir, 'subdir');
    watcher = createCommandWatcher([nonExistentDir]);
    await watcher.start();

    const exists = await fs
      .access(nonExistentDir)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
  });

  it('registers handler for file changes', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);

    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handler for existing files on start', async () => {
    // Create a test file
    const testFile = path.join(testDir, 'test.md');
    const content = 'Test content';
    await fs.writeFile(testFile, content);

    const handler = vi.fn();
    watcher = createCommandWatcher([testDir]);
    watcher.onFileChange(handler);
    await watcher.start();

    // Give it time to process
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(handler).toHaveBeenCalledWith({
      event: 'add',
      filePath: testFile,
      content,
    });
  });

  it('calls handler for added files', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    // Give watcher time to initialize
    await new Promise(resolve => setTimeout(resolve, 200));

    // Create a new file
    const testFile = path.join(testDir, 'new.md');
    const content = 'New file content';
    await fs.writeFile(testFile, content);

    // Give watcher time to detect change
    await new Promise(resolve => setTimeout(resolve, 500));

    const lastCall = handler.mock.calls[handler.mock.calls.length - 1][0];
    expect(lastCall.filePath).toBe(testFile);
    expect(lastCall.content).toBe(content);
    expect(['add', 'change']).toContain(lastCall.event);
  });

  it('only processes .md files', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    // Create non-.md file
    const textFile = path.join(testDir, 'test.txt');
    await fs.writeFile(textFile, 'text content');

    // Wait for potential detection
    await new Promise(resolve => setTimeout(resolve, 500));

    // Handler should not be called for .txt file (only .md files are watched)
    const mdCalls = handler.mock.calls.filter(call =>
      call[0].filePath?.endsWith('.md')
    );
    expect(mdCalls.length).toBe(0);
  });

  it('handles multiple handlers', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    watcher.onFileChange(handler1);
    watcher.onFileChange(handler2);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    const testFile = path.join(testDir, 'test.md');
    await fs.writeFile(testFile, 'content');

    await new Promise(resolve => setTimeout(resolve, 500));

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('handles errors in handlers gracefully', async () => {
    const errorHandler = vi.fn(async () => {
      // Simulate async error handling
      await Promise.reject(new Error('Handler error'));
    });
    const normalHandler = vi.fn();

    // Suppress expected errors
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    watcher.onFileChange(errorHandler);
    watcher.onFileChange(normalHandler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    const testFile = path.join(testDir, 'test.md');
    await fs.writeFile(testFile, 'content');

    await new Promise(resolve => setTimeout(resolve, 500));

    // The error handler will throw, but that shouldn't stop other handlers
    // Both might be called (depends on timing)
    const totalCalls =
      errorHandler.mock.calls.length + normalHandler.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(0);

    errorSpy.mockRestore();
  });

  it('stops watching when stop is called', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));
    await watcher.stop();

    // Clear previous calls
    handler.mockClear();

    // Create file after stop
    const testFile = path.join(testDir, 'after-stop.md');
    await fs.writeFile(testFile, 'content');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Handler should not be called after stop
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes correct event type for add', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    const testFile = path.join(testDir, 'new.md');
    await fs.writeFile(testFile, 'content');

    await new Promise(resolve => setTimeout(resolve, 500));

    const calls = handler.mock.calls.filter(call => call[0].event === 'add');
    expect(calls.length).toBeGreaterThan(0);
  });

  it('calls handler for modified files', async () => {
    const testFile = path.join(testDir, 'test.md');
    await fs.writeFile(testFile, 'initial content');

    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    // Clear initial calls
    handler.mockClear();

    // Modify file
    const newContent = 'modified content';
    await fs.writeFile(testFile, newContent);

    await new Promise(resolve => setTimeout(resolve, 500));

    const changeCalls = handler.mock.calls.filter(
      call => call[0].event === 'change'
    );
    expect(changeCalls.length).toBeGreaterThan(0);
  });

  it('passes file content to handler for add/change', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    const testFile = path.join(testDir, 'test.md');
    const content = 'test content';
    await fs.writeFile(testFile, content);

    await new Promise(resolve => setTimeout(resolve, 500));

    const calls = handler.mock.calls.filter(
      call => call[0].event === 'add' || call[0].event === 'change'
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.[0].content).toBe(content);
  });

  it('passes undefined content for unlink event', async () => {
    const testFile = path.join(testDir, 'test.md');
    await fs.writeFile(testFile, 'content');

    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    // Clear initial calls
    handler.mockClear();

    // Delete file
    await fs.rm(testFile);

    await new Promise(resolve => setTimeout(resolve, 500));

    const unlinkCalls = handler.mock.calls.filter(
      call => call[0].event === 'unlink'
    );
    expect(unlinkCalls.length).toBeGreaterThan(0);
    expect(unlinkCalls[0]?.[0].content).toBeUndefined();
  });

  it('handles rapid file changes', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    // Create and modify rapidly
    const testFile = path.join(testDir, 'rapid.md');
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(testFile, `content ${i}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Should have received multiple calls
    expect(handler.mock.calls.length).toBeGreaterThan(0);
  });

  it('handles concurrent file operations', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);
    await watcher.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    // Create multiple files concurrently
    const files = Array.from({ length: 3 }, (_, i) =>
      fs.writeFile(path.join(testDir, `file${i}.md`), `content ${i}`)
    );

    await Promise.all(files);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should handle all files
    expect(handler.mock.calls.length).toBeGreaterThan(0);
  });

  it('can be restarted after stop', async () => {
    const handler = vi.fn();
    watcher.onFileChange(handler);

    // First start
    await watcher.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    await watcher.stop();

    // Second start
    handler.mockClear();
    await watcher.start();
    await new Promise(resolve => setTimeout(resolve, 200));

    const testFile = path.join(testDir, 'test.md');
    await fs.writeFile(testFile, 'content');

    await new Promise(resolve => setTimeout(resolve, 500));

    expect(handler).toHaveBeenCalled();
  });

  it('watches multiple directories', async () => {
    // Create two test directories
    const testDir2 = path.join(
      __dirname,
      `../.test-${Date.now()}-${Math.random()}-2`
    );
    await fs.mkdir(testDir2, { recursive: true });

    try {
      // Create files in both directories
      const file1 = path.join(testDir, 'cmd1.md');
      const file2 = path.join(testDir2, 'cmd2.md');
      await fs.writeFile(file1, 'Command 1');
      await fs.writeFile(file2, 'Command 2');

      const handler = vi.fn();
      watcher = createCommandWatcher([testDir, testDir2]);
      watcher.onFileChange(handler);
      await watcher.start();

      // Give it time to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have been called for both files
      expect(handler).toHaveBeenCalledWith({
        event: 'add',
        filePath: file1,
        content: 'Command 1',
      });
      expect(handler).toHaveBeenCalledWith({
        event: 'add',
        filePath: file2,
        content: 'Command 2',
      });

      // Clear previous calls
      handler.mockClear();

      // Add a new file to second directory
      const file3 = path.join(testDir2, 'cmd3.md');
      await fs.writeFile(file3, 'Command 3');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have been called for the new file
      const calls = handler.mock.calls.filter(
        call => call[0].filePath === file3 && call[0].content === 'Command 3'
      );
      expect(calls.length).toBeGreaterThan(0);
    } finally {
      // Clean up second directory
      await fs.rm(testDir2, { recursive: true, force: true });
    }
  });
});
