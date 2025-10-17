/**
 * @fileoverview File watcher for dynamic command loading
 * Monitors directories for .md files and notifies handlers of changes.
 */

import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';

type WatcherEvent = 'add' | 'change' | 'unlink';

type FileChangeEvent = {
  event: WatcherEvent;
  filePath: string;
  content?: string;
};

type FileChangeHandler = (_change: FileChangeEvent) => void | Promise<void>;

/**
 * Creates a file watcher that monitors directories for markdown file changes.
 * @param {string | string[]} commandsDirs - Directory path(s) to watch
 * @returns {Object} Watcher instance with onFileChange, start, and stop methods
 */
const createCommandWatcher = (commandsDirs: string[]) => {
  let watcher: chokidar.FSWatcher | null = null;
  const dirs = Array.isArray(commandsDirs) ? commandsDirs : [commandsDirs];
  const handlers: Set<FileChangeHandler> = new Set();

  /**
   * Registers a handler to be called on file changes.
   * @param {FileChangeHandler} handler - Callback for add/change/unlink events
   */
  const onFileChange = (handler: FileChangeHandler): void => {
    handlers.add(handler);
  };

  const notifyHandlers = async (change: FileChangeEvent): Promise<void> => {
    const promises = Array.from(handlers).map(handler =>
      Promise.resolve(handler(change)).catch(error => {
        console.error(`Handler error for ${change.filePath}:`, error);
      })
    );
    await Promise.all(promises);
  };

  const handleFileChange = async (
    event: WatcherEvent,
    filePath: string
  ): Promise<void> => {
    const content =
      event === 'unlink'
        ? undefined
        : await fs.readFile(filePath, 'utf-8').catch(error => {
            console.error(`Failed to read file ${filePath}:`, error);
            return undefined;
          });
    await notifyHandlers({ event, filePath, content });
  };

  /**
   * Starts watching directories for .md file changes.
   * @returns {Promise<void>}
   */
  const start = async (): Promise<void> => {
    // Ensure all directories exist
    await Promise.all(dirs.map(dir => fs.mkdir(dir, { recursive: true })));

    // Load existing .md files
    await Promise.all(
      dirs.map(async dir => {
        try {
          const files = await fs.readdir(dir);
          const mdFiles = files.filter(f => f.endsWith('.md'));
          const reads = mdFiles.map(async file => {
            const filePath = path.join(dir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            await notifyHandlers({ event: 'add', filePath, content });
          });
          await Promise.all(reads);
        } catch (error) {
          console.error(`Failed to read directory ${dir}:`, error);
        }
      })
    );

    // Watch for future changes
    const patterns = dirs.map(dir => path.join(dir, '*.md'));
    watcher = chokidar.watch(patterns, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    watcher
      .on('add', filePath => handleFileChange('add', filePath))
      .on('change', filePath => handleFileChange('change', filePath))
      .on('unlink', filePath => handleFileChange('unlink', filePath));
  };

  /**
   * Stops the file watcher.
   * @returns {Promise<void>}
   */
  const stop = async (): Promise<void> => {
    if (watcher) {
      await watcher.close();
      watcher = null;
    }
  };

  return { onFileChange, start, stop };
};

export { createCommandWatcher };
export type { FileChangeHandler, FileChangeEvent, WatcherEvent };
