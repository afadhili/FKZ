/**
 * Basic Plugin Template
 * Use this as a starting point for creating new plugins
 */
import { SerializedMessage } from "../../lib/serialize";
import { WASocket } from "@whiskeysockets/baileys";

/**
 * Basic plugin template with a simple command
 * @returns Plugin object
 */
export default () => ({
  info: {
    name: "Example Plugin",
    version: "1.0.0",
    author: "Your Name",
    description: "Description of what this plugin does",
  },
  commands: [
    {
      commands: ["example", "ex"],  // Command triggers (you can have multiple aliases)
      description: "Example command description", // Shown in help menu
      async handler(sock: WASocket, message: SerializedMessage, args: string[]) {
        // Your command logic goes here
        await message.reply(`Example command executed with args: ${args.join(', ') || 'none'}`);
      },
    },
  ],
  // Optional: Handle messages that aren't commands
  // Return true if the message was handled, false otherwise
  async handleMessage(sock: WASocket, message: SerializedMessage): Promise<boolean> {
    // Example: respond to messages containing a specific word
    if (message.message.text?.toLowerCase().includes('hello')) {
      await message.reply('Hi there! I noticed you said hello.');
      return true; // Message was handled
    }
    return false; // Message wasn't handled
  },
});