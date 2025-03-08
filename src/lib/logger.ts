import chalk from "chalk";

/**
 * Custom logger for the WhatsApp bot with colorful output and structured logging
 */
export class Logger {
  // Queue for log messages to ensure sequential processing
  private static logQueue: Array<() => void> = [];

  // Flag to track if we're currently processing the log queue
  private static isProcessingQueue = false;

  // Log levels for better organization
  private static readonly LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    SUCCESS: 2,
    WARN: 3,
    ERROR: 4,
  };

  // Current log level (default to INFO)
  private static currentLogLevel = Logger.LOG_LEVELS.INFO;

  /**
   * Set the current log level
   * @param level - The log level to set
   */
  static setLogLevel(level: keyof typeof Logger.LOG_LEVELS): void {
    if (Logger.LOG_LEVELS[level] !== undefined) {
      Logger.currentLogLevel = Logger.LOG_LEVELS[level];
    }
  }

  /**
   * Add a log message to the queue and process the queue
   * @param level - The log level
   * @param logFn - The function that performs the actual logging
   */
  private static queueLog(level: number, logFn: () => void): void {
    // Only queue logs that meet the current log level threshold
    if (level >= Logger.currentLogLevel) {
      Logger.logQueue.push(logFn);
      Logger.processLogQueue();
    }
  }

  /**
   * Process the log queue sequentially
   */
  private static async processLogQueue(): Promise<void> {
    // If already processing, return (the current process will handle all queued items)
    if (Logger.isProcessingQueue) return;

    Logger.isProcessingQueue = true;

    try {
      while (Logger.logQueue.length > 0) {
        const logFn = Logger.logQueue.shift();
        if (logFn) {
          logFn();
          // Small delay to ensure console output is complete
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }
    } finally {
      Logger.isProcessingQueue = false;
    }
  }

  /**
   * Get a formatted timestamp
   */
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Log a debug message
   * @param message - The message to log
   */
  static debug(message: string): void {
    Logger.queueLog(Logger.LOG_LEVELS.DEBUG, () => {
      console.log(
        chalk.gray(`[${Logger.getTimestamp()}] `) +
          chalk.cyan("🔍 DEBUG") +
          " " +
          chalk.white(message)
      );
    });
  }

  /**
   * Log a regular info message
   * @param message - The message to log
   */
  static info(message: string): void {
    Logger.queueLog(Logger.LOG_LEVELS.INFO, () => {
      console.log(
        chalk.gray(`[${Logger.getTimestamp()}] `) +
          chalk.blue("ℹ️ INFO") +
          " " +
          chalk.white(message)
      );
    });
  }

  /**
   * Log a success message
   * @param message - The message to log
   */
  static success(message: string): void {
    Logger.queueLog(Logger.LOG_LEVELS.SUCCESS, () => {
      console.log(
        chalk.gray(`[${Logger.getTimestamp()}] `) +
          chalk.green("✅ SUCCESS") +
          " " +
          chalk.white(message)
      );
    });
  }

  /**
   * Log a warning message
   * @param message - The message to log
   */
  static warn(message: string): void {
    Logger.queueLog(Logger.LOG_LEVELS.WARN, () => {
      console.log(
        chalk.gray(`[${Logger.getTimestamp()}] `) +
          chalk.yellow("⚠️ WARNING") +
          " " +
          chalk.white(message)
      );
    });
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param error - Optional error object
   */
  static error(message: string, error?: any): void {
    Logger.queueLog(Logger.LOG_LEVELS.ERROR, () => {
      console.error(
        chalk.gray(`[${Logger.getTimestamp()}] `) +
          chalk.red("❌ ERROR") +
          " " +
          chalk.white(message)
      );
      if (error) {
        console.error(
          chalk.red(
            error instanceof Error ? error.stack : JSON.stringify(error)
          )
        );
      }
    });
  }

  /**
   * Log a connection status message
   * @param status - The connection status
   * @param details - Optional details about the connection
   */
  static connection(status: string, details?: string): void {
    Logger.queueLog(Logger.LOG_LEVELS.INFO, () => {
      const statusColor =
        status === "open"
          ? chalk.green("🔌 CONNECTED")
          : status === "close"
          ? chalk.red("🔌 DISCONNECTED")
          : chalk.yellow("🔌 " + status.toUpperCase());

      console.log(
        chalk.gray(`[${Logger.getTimestamp()}] `) +
          statusColor +
          (details ? " " + chalk.gray(details) : "") +
          "\n"
      );
    });
  }

  /**
   * Log an incoming message
   * @param sender - The sender's information
   * @param message - The message content
   */
  static incomingMessage(
    sender: { jid: string; name?: string },
    message: { command?: string; body: string }
  ): void {
    Logger.queueLog(Logger.LOG_LEVELS.INFO, () => {
      console.log(
        chalk.gray(`\n[${Logger.getTimestamp()}]\n`) +
          chalk.magenta("📩 MESSAGE") +
          " " +
          chalk.yellow("From: ") +
          chalk.white(sender.name || "Unknown") +
          chalk.gray(` (${sender.jid})`) +
          "\n" +
          (message.command
            ? chalk.yellow("Command: ") + chalk.cyan(message.command) + "\n"
            : "") +
          chalk.yellow("Body: ") +
          chalk.white(message.body) +
          "\n"
      );
    });
  }

  /**
   * Log an outgoing message
   * @param recipient - The recipient's information
   * @param message - The message content
   */
  static outgoingMessage(
    recipient: { jid: string; name?: string },
    message: string
  ): void {
    Logger.queueLog(Logger.LOG_LEVELS.INFO, () => {
      console.log(
        chalk.gray(`[${Logger.getTimestamp()}] `) +
          chalk.blue("📤 SENT") +
          " " +
          chalk.yellow("To: ") +
          chalk.white(recipient.name || "Unknown") +
          chalk.gray(` (${recipient.jid})`) +
          "\n" +
          chalk.yellow("Body: ") +
          chalk.white(message) +
          "\n"
      );
    });
  }

  /**
   * Log QR code information
   */
  static qrCode(): void {
    Logger.queueLog(Logger.LOG_LEVELS.INFO, () => {
      console.log(
        chalk.gray(`[${Logger.getTimestamp()}] `) +
          chalk.cyan("🔐 QR CODE") +
          " " +
          chalk.white(
            "Scan the QR code that appears in the terminal to log in"
          ) +
          "\n"
      );
    });
  }
}
