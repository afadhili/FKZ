// Monitor script for WhatsApp bot with auto-restart functionality
import treeKill from "tree-kill";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { watch } from "fs";
import { Logger } from "./lib/logger";

// We'll use the Logger's built-in timestamp functionality
// No need for a separate getTimestamp function anymore

// Track the current process
let currentProcess: ChildProcess | null = null;

// Track file watchers
let fileWatchers: fs.FSWatcher[] = [];

// Track if we're in the process of restarting
let isRestarting = false;

// Debounce timer for file changes
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_TIME = 500; // ms

// Track if we're shutting down
let isShuttingDown = false;

/**
 * Start or restart the main application
 * @param {string} file - The main file to run
 */
function startApp(file: string): void {
  // Prevent multiple restarts
  if (isRestarting) {
    Logger.warn(`Already restarting, ignoring request`);
    return;
  }

  isRestarting = true;

  if (currentProcess) {
    Logger.info(`Terminating existing process (PID: ${currentProcess.pid})...`);
    treeKill(currentProcess.pid!, "SIGTERM", (err?: Error) => {
      if (err) {
        Logger.error(`Error killing process`, err);
        // Continue with restart even if there was an error
        currentProcess = null;
        setTimeout(() => {
          isRestarting = false;
          startAppProcess(file);
        }, 1000);
      } else {
        Logger.success(`Process terminated successfully`);
        currentProcess = null;
        setTimeout(() => {
          isRestarting = false;
          startAppProcess(file);
        }, 1000);
      }
    });
  } else {
    startAppProcess(file);
    isRestarting = false;
  }
}

/**
 * Start the application process
 * @param {string} file - The main file to run
 */
function startAppProcess(file: string): void {
  if (isShuttingDown) {
    Logger.warn(`System is shutting down, not starting new process`);
    return;
  }

  Logger.info(`Starting WhatsApp bot with file: ${file}`);
  const mainFile = path.join(process.cwd(), file);

  // Check if we're running the TypeScript or JavaScript version
  const isTypeScript = file.endsWith(".ts");

  let args: string[] = [];
  let command: string = "";

  if (isTypeScript) {
    // For TypeScript, use node with ts-node/register
    command = process.execPath; // node executable
    args = ["-r", "ts-node/register", mainFile, ...process.argv.slice(3)];
  } else {
    // For JavaScript, use node directly
    command = process.argv[0]; // node executable
    args = [mainFile, ...process.argv.slice(3)];
  }

  const proc = spawn(command, args, {
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  proc.on("message", (data: any) => {
    Logger.info(
      `[RECEIVED] ${typeof data === "object" ? JSON.stringify(data) : data}`
    );
    if (data === "restart") {
      Logger.info(`Restart command received, restarting application...`);
      startApp(file);
    } else if (data === "ready") {
      Logger.success(`Bot is ready, setting up file watchers`);
      // Set up file watchers once the bot is ready
      setupFileWatchers(proc, file);
    }
  });

  proc.on("exit", (code: number | null) => {
    if (isShuttingDown) {
      Logger.info(`Child process exited during shutdown`);
      return;
    }

    if (code === 0) {
      Logger.info(`Bot exited with code: ${code} (normal shutdown)`);
    } else {
      Logger.error(`Bot exited with code: ${code} (abnormal shutdown)`);
    }
    currentProcess = null;

    // Clean up file watchers
    cleanupFileWatchers();

    if (code !== 0 && !isRestarting && !isShuttingDown) {
      Logger.warn(`Error detected, restarting in 5 seconds...`);
      setTimeout(() => {
        startApp(file);
      }, 5000);
    }
  });

  // Handle errors
  proc.on("error", (err) => {
    Logger.error(`Failed to start child process:`, err);
    currentProcess = null;
  });

  currentProcess = proc;
}

/**
 * Set up file watchers for the src directory
 * @param proc The child process
 * @param mainFile The main file path
 */
function setupFileWatchers(proc: ChildProcess, mainFile: string): void {
  // Clean up any existing watchers
  cleanupFileWatchers();

  const srcDir = path.join(process.cwd(), "src");
  const pluginsDir = path.join(srcDir, "plugins");

  Logger.info(`Setting up file watchers for ${srcDir}`);
  Logger.info(`Plugins directory: ${pluginsDir}`);

  // Watch the entire src directory recursively
  const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename || isShuttingDown) return;

    const fullPath = path.join(srcDir, filename);

    // Skip node_modules and non-code files
    if (filename.includes("node_modules") || !filename.match(/\.(ts|js)$/)) {
      return;
    }

    Logger.info(`File change detected: ${eventType} - ${fullPath}`);

    // Debounce file changes to prevent multiple restarts
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      // Handle different types of files differently
      if (filename.startsWith(path.join("plugins", path.sep))) {
        // For plugin files, send a message to reload just that plugin
        Logger.info(`Plugin change detected: ${filename}`);
        if (proc && proc.connected) {
          proc.send({ type: "reloadPlugin", path: fullPath });
          Logger.success(`Sent reload command for plugin: ${filename}`);
        } else {
          Logger.warn(`Cannot reload plugin: process not connected`);
        }
      } else if (
        filename === path.basename(mainFile) ||
        filename === "index.ts" ||
        filename.includes("config")
      ) {
        // For core files, restart the entire application
        Logger.warn(
          `Core file change detected in ${filename}, restarting application...`
        );
        startApp(mainFile);
      } else {
        // For other files, send a notification but don't restart
        Logger.info(`Non-plugin, non-core file changed: ${filename}`);
        if (proc && proc.connected) {
          proc.send({ type: "fileChanged", path: fullPath });
          Logger.info(`Sent file change notification for: ${filename}`);
        } else {
          Logger.warn(
            `Cannot send file change notification: process not connected`
          );
        }
      }
    }, DEBOUNCE_TIME);
  });

  fileWatchers.push(watcher);
}

/**
 * Clean up all file watchers
 */
function cleanupFileWatchers(): void {
  const watcherCount = fileWatchers.length;
  if (watcherCount > 0) {
    Logger.info(`Cleaning up ${watcherCount} file watchers`);
    fileWatchers.forEach((watcher) => {
      watcher.close();
    });
    fileWatchers = [];
    Logger.success(`All file watchers cleaned up successfully`);
  } else {
    Logger.info(`No file watchers to clean up`);
  }
}

/**
 * Gracefully shutdown the application
 */
function gracefulShutdown(): void {
  if (isShuttingDown) {
    return; // Prevent multiple shutdown attempts
  }

  isShuttingDown = true;
  Logger.warn(`Initiating graceful shutdown...`);

  // Clear any pending timers
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // Clean up file watchers
  cleanupFileWatchers();

  if (currentProcess && currentProcess.pid) {
    Logger.info(`Terminating child process (PID: ${currentProcess.pid})`);

    // Set a timeout to force exit if child doesn't terminate
    const forceExitTimer = setTimeout(() => {
      Logger.error(`Force exiting after timeout`);
      process.exit(1);
    }, 5000);

    treeKill(currentProcess.pid, "SIGTERM", (err) => {
      clearTimeout(forceExitTimer);

      if (err) {
        Logger.error(`Error terminating child process`, err);
      } else {
        Logger.success(`Child process terminated successfully`);
      }
      Logger.info(`Monitor shutting down`);
      process.exit(0);
    });
  } else {
    Logger.info(`No child process to terminate, shutting down`);
    process.exit(0);
  }
}

// Determine which file to run based on arguments
const fileToRun = process.argv[2] || "dist/index.js";

// Start the application
Logger.info(`Starting monitor for ${fileToRun}`);
Logger.info(`Process ID: ${process.pid}`);
startApp(fileToRun);

// Handle process termination signals
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  Logger.error(`Uncaught exception in monitor`, error);
  // Don't exit here, let the monitor continue running
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  Logger.error(`Unhandled promise rejection in monitor`, {
    reason,
  });
  // Don't exit here, let the monitor continue running
});
