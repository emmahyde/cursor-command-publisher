/**
 * File watcher for dynamic command loading
 * Monitors directory for .md files and notifies of changes
 */

import fs from "fs/promises";
import path from "path";
import chokidar from "chokidar";

export type FileChangeHandler = (
  event: "add" | "change" | "unlink",
  filePath: string,
  content?: string
) => void | Promise<void>;

export class CommandWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private commandsDir: string;
  private handlers: Set<FileChangeHandler> = new Set();

  constructor(commandsDir: string) {
    this.commandsDir = commandsDir;
  }

  /**
   * Register a handler to be called on file changes
   */
  onFileChange(handler: FileChangeHandler): void {
    this.handlers.add(handler);
  }

  /**
   * Start watching the commands directory
   */
  async start(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.commandsDir, { recursive: true });

    // Load initial files
    const files = await fs.readdir(this.commandsDir);
    for (const file of files) {
      if (file.endsWith(".md")) {
        const filePath = path.join(this.commandsDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        await this.notifyHandlers("add", filePath, content);
      }
    }

    // Start watching
    this.watcher = chokidar.watch(path.join(this.commandsDir, "*.md"), {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher
      .on("add", (filePath) => this.handleFileChange("add", filePath))
      .on("change", (filePath) => this.handleFileChange("change", filePath))
      .on("unlink", (filePath) => this.handleFileChange("unlink", filePath));
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private async handleFileChange(
    event: "add" | "change" | "unlink",
    filePath: string
  ): Promise<void> {
    let content: string | undefined;

    if (event !== "unlink") {
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error);
        return;
      }
    }

    await this.notifyHandlers(event, filePath, content);
  }

  private async notifyHandlers(
    event: "add" | "change" | "unlink",
    filePath: string,
    content?: string
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const handler of this.handlers) {
      promises.push(
        Promise.resolve(handler(event, filePath, content)).catch((error) => {
          console.error(`Handler error for ${filePath}:`, error);
        })
      );
    }

    await Promise.all(promises);
  }
}
