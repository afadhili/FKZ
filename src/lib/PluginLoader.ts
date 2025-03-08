/**
 *  Plugin System for WhatsApp Bot
 * Provides better performance through lazy loading, improved error handling,
 * and a simplified API for plugin development.
 */
import fs from "fs";
import path from "path";
import { Logger } from "./logger";
import { WASocket } from "@whiskeysockets/baileys";
import { SerializedMessage } from "./serialize";

//  interfaces
export interface CommandHandler {
  commands: string[];
  description?: string;
  category?: string;
  handler: (
    sock: WASocket,
    message: SerializedMessage,
    args: string[]
  ) => Promise<void>;
}

export interface Plugin {
  info: {
    name: string;
    version: string;
    author: string;
    description?: string;
  };
  category?: string;
  init?: () => Promise<void>;
  commands?: CommandHandler[];
  handleMessage?: (
    sock: WASocket,
    message: SerializedMessage
  ) => Promise<boolean>;
}

export interface PluginContext {
  registerCommand: (handler: CommandHandler) => void;
  pluginLoader: PluginLoader;
}

/**
 * Plugin metadata for lazy loading
 */
interface PluginMetadata {
  filePath: string;
  category?: string;
  loaded: boolean;
  plugin?: Plugin;
}

/**
 *  Plugin Loader with performance improvements
 */
export class PluginLoader {
  private commands = new Map<string, CommandHandler>();
  private pluginMetadata: PluginMetadata[] = [];
  private loadedPlugins: Plugin[] = [];

  constructor(private pluginsDir: string) {}

  /**
   * Discovers all plugins but doesn't load them immediately
   * This improves startup time by deferring plugin initialization
   */
  async discoverPlugins(): Promise<void> {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
      Logger.info(`Created plugins directory at ${this.pluginsDir}`);
      return;
    }

    // Discover plugins in directories without loading them
    await this.discoverDirectory(this.pluginsDir);
    Logger.info(`Discovered ${this.pluginMetadata.length} plugins`);
  }

  /**
   * Loads all discovered plugins
   */
  async loadAllPlugins(): Promise<void> {
    const startTime = Date.now();

    // Load all discovered plugins
    const loadPromises = this.pluginMetadata
      .filter((meta) => !meta.loaded)
      .map((meta) => this.loadPlugin(meta));

    await Promise.all(loadPromises);

    const loadTime = Date.now() - startTime;
    Logger.info(
      `Loaded ${this.loadedPlugins.length} plugins with ${this.commands.size} commands in ${loadTime}ms`
    );
  }

  /**
   * Discovers plugins in a directory without loading them
   */
  private async discoverDirectory(
    dirPath: string,
    category?: string
  ): Promise<void> {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          // Recursively discover subdirectories with new category
          await this.discoverDirectory(fullPath, item.name);
        } else if (
          item.isFile() &&
          (item.name.endsWith(".ts") || item.name.endsWith(".js"))
        ) {
          // Add to metadata without loading
          this.pluginMetadata.push({
            filePath: fullPath,
            category,
            loaded: false,
          });
        }
      }
    } catch (error) {
      Logger.error(`Error discovering plugins in ${dirPath}:`, error);
    }
  }

  /**
   * Loads a specific plugin by its metadata
   */
  private async loadPlugin(metadata: PluginMetadata): Promise<void> {
    if (metadata.loaded) return;

    try {
      const pluginModule = await import(metadata.filePath);
      const pluginExport = pluginModule.default;
      const context: PluginContext = {
        registerCommand: (handler: CommandHandler) =>
          this.registerCommands([handler]),
        pluginLoader: this,
      };

      let plugin: Plugin;
      if (typeof pluginExport === "function") {
        plugin = pluginExport(context);
      } else {
        plugin = pluginExport;
      }

      // Set category from directory name
      plugin.category = metadata.category;

      if (plugin.init) await plugin.init();
      if (plugin.commands) {
        plugin.commands.forEach((cmd) => (cmd.category = metadata.category));
        this.registerCommands(plugin.commands);
      }

      // Update metadata and add to loaded plugins
      metadata.loaded = true;
      metadata.plugin = plugin;
      this.loadedPlugins.push(plugin);

      Logger.success(
        `Loaded ${
          metadata.category ? "[" + metadata.category + "] " : ""
        }plugin: ${plugin.info.name}`
      );
    } catch (error) {
      Logger.error(`Error loading plugin ${metadata.filePath}:`, error);
    }
  }

  /**
   * Registers command handlers
   */
  private registerCommands(handlers: CommandHandler[]): void {
    for (const handler of handlers) {
      for (const command of handler.commands) {
        const normalizedCmd = command.toLowerCase();
        if (this.commands.has(normalizedCmd)) {
          Logger.warn(`Command conflict: ${normalizedCmd} already exists`);
          continue;
        }
        this.commands.set(normalizedCmd, handler);
      }
    }
  }

  /**
   * Handles incoming messages and routes them to appropriate plugins
   */
  async handleMessage(
    sock: WASocket,
    message: SerializedMessage
  ): Promise<void> {
    const { command, args } = message.message;

    if (command) {
      const handler = this.commands.get(command.toLowerCase());
      if (handler) {
        try {
          await handler.handler(sock, message, args || []);
          return;
        } catch (error) {
          Logger.error(`Error handling command ${command}:`, error);
          await message.reply(
            "❌ An error occurred while processing your command."
          );
          return;
        }
      }
    }

    // Fallback to plugin message handlers
    for (const plugin of this.loadedPlugins) {
      if (plugin.handleMessage) {
        try {
          if (await plugin.handleMessage(sock, message)) {
            return;
          }
        } catch (error) {
          Logger.error(`Error in plugin message handler:`, error);
        }
      }
    }
  }

  /**
   * Returns all registered commands
   */
  getCommands(): Map<string, CommandHandler> {
    return new Map(this.commands);
  }

  /**
   * Unloads all plugins
   */
  async unloadPlugins(): Promise<void> {
    this.commands.clear();
    this.loadedPlugins = [];
    this.pluginMetadata.forEach((meta) => {
      meta.loaded = false;
      meta.plugin = undefined;
    });
    Logger.info("All plugins unloaded");
  }

  /**
   * Unloads a specific plugin by file path
   * @param filePath Path to the plugin file
   */
  async unloadPlugin(filePath: string): Promise<boolean> {
    const normalizedPath = path.normalize(filePath);
    const metaIndex = this.pluginMetadata.findIndex(
      (meta) => path.normalize(meta.filePath) === normalizedPath
    );

    if (metaIndex === -1 || !this.pluginMetadata[metaIndex].loaded) {
      return false;
    }

    const metadata = this.pluginMetadata[metaIndex];
    const plugin = metadata.plugin;

    if (!plugin) return false;

    // Remove commands from this plugin
    if (plugin.commands) {
      for (const handler of plugin.commands) {
        for (const command of handler.commands) {
          this.commands.delete(command.toLowerCase());
        }
      }
    }

    // Remove from loaded plugins
    const pluginIndex = this.loadedPlugins.findIndex((p) => p === plugin);
    if (pluginIndex !== -1) {
      this.loadedPlugins.splice(pluginIndex, 1);
    }

    // Update metadata
    metadata.loaded = false;
    metadata.plugin = undefined;

    Logger.info(`Unloaded plugin: ${normalizedPath}`);
    return true;
  }

  /**
   * Reloads a specific plugin by file path
   * @param filePath Path to the plugin file
   */
  async reloadPlugin(filePath: string): Promise<boolean> {
    const normalizedPath = path.normalize(filePath);

    // First try to find if this plugin is already in metadata
    let metaIndex = this.pluginMetadata.findIndex(
      (meta) => path.normalize(meta.filePath) === normalizedPath
    );

    // If not found, check if it's a new plugin
    if (metaIndex === -1) {
      if (!fs.existsSync(filePath)) {
        Logger.error(`Plugin file not found: ${filePath}`);
        return false;
      }

      // Determine category from directory structure
      const relativePath = path.relative(
        this.pluginsDir,
        path.dirname(filePath)
      );
      const category = relativePath.split(path.sep)[0];

      // Add to metadata
      this.pluginMetadata.push({
        filePath: normalizedPath,
        category: category !== "" ? category : undefined,
        loaded: false,
      });

      metaIndex = this.pluginMetadata.length - 1;
    } else {
      // Unload existing plugin
      await this.unloadPlugin(filePath);

      // Clear module cache to ensure fresh import
      delete require.cache[require.resolve(filePath)];
    }

    // Load the plugin
    await this.loadPlugin(this.pluginMetadata[metaIndex]);
    return true;
  }

  /**
   * Creates a new plugin with minimal boilerplate
   */
  static createPlugin(options: {
    name: string;
    version?: string;
    author?: string;
    description?: string;
    commands?: CommandHandler[];
    messageHandler?: (
      sock: WASocket,
      message: SerializedMessage
    ) => Promise<boolean>;
  }): Plugin {
    return {
      info: {
        name: options.name,
        version: options.version || "1.0.0",
        author: options.author || "Bot User",
        description: options.description,
      },
      commands: options.commands || [],
      handleMessage: options.messageHandler,
    };
  }
}
