/**
 * Functional Plugin Template
 * This template demonstrates how to create plugins using the  plugin loader
 * with a more functional approach and less boilerplate.
 */
import { SerializedMessage } from "../../lib/serialize";
import { WASocket } from "@whiskeysockets/baileys";
import { PluginLoader } from "../../lib/PluginLoader";

/**
 * Example of creating a plugin using the functional approach
 * @returns Plugin object
 */
export default () => {
  // Create a plugin with minimal boilerplate
  return PluginLoader.createPlugin({
    name: "Functional Example Plugin",
    version: "1.0.0",
    author: "Your Name",
    description: "Example of a plugin using the functional approach",

    // Define commands
    commands: [
      {
        commands: ["func", "functional"],
        description: "Example of a functional plugin command",
        async handler(
          sock: WASocket,
          message: SerializedMessage,
          args: string[]
        ) {
          await message.reply(
            `Functional plugin command executed with args: ${
              args.join(", ") || "none"
            }`
          );
        },
      },
    ],

    // Optional message handler
    messageHandler: async (sock: WASocket, message: SerializedMessage) => {
      // Example: respond to messages containing a specific word
      if (message.message.text?.toLowerCase().includes("functional")) {
        await message.reply("This is a response from the functional plugin!");
        return true; // Message was handled
      }
      return false; // Message wasn't handled
    },
  });
};
