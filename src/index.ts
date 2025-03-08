// Import required packages
import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { serialize } from "./lib/serialize";
import { Logger } from "./lib/logger";
import { PluginLoader } from "./lib/PluginLoader";
import pino from "pino";
import { config } from "./config";

// For process communication with monitor
const isChild = !!process.send;

// Path for storing session data
const SESSION_DIR = path.join(__dirname, "..", "session");

// Path for plugins directory
const PLUGINS_DIR = path.join(__dirname, "plugins");

// Create session directory if it doesn't exist
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Initialize enhanced plugin loader
const pluginLoader = new PluginLoader(PLUGINS_DIR);

// Function to handle connection
async function connectToWhatsApp() {
  // Load or create session credentials
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  // Create WhatsApp connection
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: config.pairing_code.status ? false : true,
    logger: pino({
      level: "silent",
    }),
  });

  // Save session credentials on update
  sock.ev.on("creds.update", saveCreds);

  // Handle connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      Logger.qrCode();
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      Logger.connection(
        "close",
        `due to ${lastDisconnect?.error?.toString() || "unknown reason"}`
      );

      // Reconnect if not logged out
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      Logger.connection("open");
      Logger.success("Bot is ready to use!");
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) {
      // Skip if message is from status broadcast
      if (message.key.remoteJid === "status@broadcast") continue;

      // Skip if message is from the bot itself
      if (message.key.fromMe) continue;
      if (config.selfmode) {
        config.owners.forEach((owner) => {
          if (owner === message.key.remoteJid) {
            return;
          }
        });
      }

      // Serialize the message for easier handling
      const serialized = serialize(sock, message);
      if (!serialized) continue;

      // Get sender information
      const senderJid = serialized.sender.jid;

      // Log the incoming message with our custom logger
      Logger.incomingMessage(
        {
          jid: senderJid,
          name: serialized.sender.name || "Unknown",
        },
        {
          command: serialized.message.command,
          body: serialized.message.text || serialized.message.caption || "",
        }
      );

      sock.readMessages([message.key]);

      // Process commands using the enhanced plugin system
      if (senderJid) {
        await pluginLoader.handleMessage(sock, serialized);
      }
    }
  });
}

// Error handling function
function handleError(err: Error): void {
  Logger.error("Fatal error occurred", err);

  // If running as a child process, send restart signal to monitor
  if (isChild && process.send) {
    Logger.info("Sending restart signal to monitor...");
    process.send("restart");
  }

  // Exit with error code to trigger restart
  process.exit(1);
}

// Set up global error handlers
process.on("uncaughtException", (err) => {
  Logger.error("Uncaught exception", err);
  handleError(err);
});

process.on("unhandledRejection", (reason, promise) => {
  Logger.error("Unhandled rejection", reason as Error);
  handleError(reason as Error);
});

// Handle messages from the monitor process
if (isChild) {
  process.on("message", async (message: { type: string; path: string }) => {
    if (typeof message === "object" && message !== null) {
      // Handle plugin reload requests
      if (message.type === "reloadPlugin" && message.path) {
        try {
          Logger.info(`Reloading plugin: ${message.path}`);
          const success = await pluginLoader.reloadPlugin(message.path);
          if (success) {
            Logger.success(`Plugin reloaded successfully: ${message.path}`);
          } else {
            Logger.error(`Failed to reload plugin: ${message.path}`);
          }
        } catch (error) {
          Logger.error(`Error reloading plugin: ${message.path}`, error);
        }
      }
      // Handle other file change notifications
      else if (message.type === "fileChanged" && message.path) {
        Logger.info(`File changed: ${message.path}`);
        // You can add additional handling for other file types here
      }
    }
  });
}

// Load plugins and start the bot
async function startBot() {
  try {
    // First discover plugins (faster startup)
    Logger.info("\n\n[Discovering Plugins]");
    await pluginLoader.discoverPlugins();

    // Then load all plugins
    Logger.info("\n\n[Loading Plugins]");
    await pluginLoader.loadAllPlugins();

    // Then connect to WhatsApp
    Logger.info("\n\n[Whatsapp Bot Starting]");
    Logger.info("Scan the QR code that will appear in the terminal to log in.");
    await connectToWhatsApp();

    // Signal ready state to monitor
    if (isChild && process.send) {
      process.send("ready");
    }
  } catch (err) {
    Logger.error("Unexpected error", err);
    handleError(err as Error);
  }
}

// Start the bot
startBot();

// Signal ready state to monitor
if (isChild && process.send) {
  process.send("ready");
}
