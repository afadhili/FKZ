# Trae WhatsApp Bot

A modular, plugin-based WhatsApp bot built with TypeScript and the Baileys library. This bot features a robust plugin system, automatic restart capabilities, and an enhanced logging system.

## Features

- **Plugin System**: Easily extend functionality with a modular plugin architecture
- **Auto-Restart**: Automatic recovery from crashes with the monitor system
- **Hot Reloading**: Plugins can be reloaded without restarting the entire bot
- **Enhanced Logging**: Colorful, structured logging with different log levels
- **Message Serialization**: Simplified message handling
- **TypeScript Support**: Full TypeScript integration for better development experience

## Project Structure

```
├── src/
│   ├── assets/           # Static assets
│   ├── lib/              # Core libraries
│   │   ├── PluginLoader.ts   # Plugin management system
│   │   ├── logger.ts         # Enhanced logging system
│   │   ├── serialize.ts      # Message serialization
│   │   └── functions.ts      # Utility functions
│   ├── plugins/          # Bot plugins
│   │   ├── general/          # General purpose plugins
│   │   ├── utility/          # Utility plugins
│   │   └── templates/        # Plugin templates
│   ├── config.ts         # Bot configuration
│   ├── index.ts          # Main bot entry point
│   └── monitor.ts        # Process monitor for auto-restart
├── media/              # Media storage (created at runtime)
├── session/            # WhatsApp session data (created at runtime)
├── tsconfig.json      # TypeScript configuration
└── package.json       # Project dependencies
```

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Usage

### Development Mode

Run the bot in development mode with hot reloading:

```bash
npm run dev
```

### Production Mode

Build and run the bot in production mode:

```bash
npm run build
npm start
```

## Creating Plugins

Plugins are the core way to extend the bot's functionality. A basic plugin template is provided in `src/plugins/templates/basicPlugin.ts`.

Here's an example of a simple plugin:

```typescript
import { SerializedMessage } from "../../lib/serialize";
import { WASocket } from "@whiskeysockets/baileys";

export default () => ({
  info: {
    name: "Example Plugin",
    version: "1.0.0",
    author: "Your Name",
    description: "Description of what this plugin does",
  },
  commands: [
    {
      commands: ["example", "ex"], // Command triggers
      description: "Example command description",
      async handler(
        sock: WASocket,
        message: SerializedMessage,
        args: string[]
      ) {
        await message.reply(
          `Example command executed with args: ${args.join(", ") || "none"}`
        );
      },
    },
  ],
  // Optional: Handle messages that aren't commands
  async handleMessage(
    sock: WASocket,
    message: SerializedMessage
  ): Promise<boolean> {
    if (message.message.text?.toLowerCase().includes("hello")) {
      await message.reply("Hi there! I noticed you said hello.");
      return true; // Message was handled
    }
    return false; // Message wasn't handled
  },
});
```

### Plugin Structure

- **info**: Metadata about the plugin
- **commands**: Array of command handlers
- **handleMessage**: Optional function to process non-command messages

### Plugin Organization

Plugins are automatically categorized based on their directory structure:

- `plugins/general/` - General purpose commands
- `plugins/utility/` - Utility functions
- Create new directories to organize plugins by category

## Logging System

The bot includes an enhanced logging system with different log levels:

```typescript
import { Logger } from "./lib/logger";

// Available log methods
Logger.debug("Debug message");
Logger.info("Info message");
Logger.success("Success message");
Logger.warn("Warning message");
Logger.error("Error message", error); // Optional error object

// Set log level
Logger.setLogLevel("DEBUG"); // Show all logs
Logger.setLogLevel("INFO"); // Default
```

## Configuration

Edit `src/config.ts` to customize the bot's behavior.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
