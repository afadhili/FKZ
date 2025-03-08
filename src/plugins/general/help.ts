import { SerializedMessage } from "../../lib/serialize";
import { CommandHandler, PluginContext } from "../../lib/PluginLoader";
import { Styles } from "../../lib/functions";
import { config } from "../../config";
export default ({ pluginLoader }: PluginContext) => ({
  info: {
    name: "Help System",
    version: "2.1.0",
    author: "Core Team",
  },
  commands: [
    {
      commands: ["help", "menu"],
      description: "Show categorized commands",
      async handler(_: any, message: SerializedMessage, args: string[]) {
        const commands = pluginLoader.getCommands();
        const categories = new Map<string, Set<CommandHandler>>();
        const pageSize = 10; // Number of categories per page
        let page = 1;
        let filter = "";

        // Parse arguments for pagination and filtering
        if (args.length > 0) {
          // Check if first argument is a page number
          if (/^\d+$/.test(args[0])) {
            page = parseInt(args[0]);
            if (args.length > 1) {
              filter = args.slice(1).join(" ").toLowerCase();
            }
          } else {
            filter = args.join(" ").toLowerCase();
          }
        }

        // Group unique handlers by category
        commands.forEach((handler) => {
          const category = handler.category || "General";
          if (!categories.has(category)) {
            categories.set(category, new Set());
          }
          categories.get(category)!.add(handler);
        });

        // Convert to array for pagination and filtering
        const categoryEntries = Array.from(categories.entries());

        // Filter categories and commands if filter is provided
        let filteredCategories = categoryEntries;
        if (filter) {
          // First, check if any category names match the filter
          const categoryMatches = categoryEntries.filter(([category]) =>
            category.toLowerCase().includes(filter)
          );

          // Then process all categories to find matching commands
          const commandMatches = categoryEntries
            .map(([category, handlers]) => {
              const filteredHandlers = new Set(
                Array.from(handlers).filter(
                  (handler) =>
                    handler.commands.some((cmd) =>
                      cmd.toLowerCase().includes(filter)
                    ) ||
                    (handler.description &&
                      handler.description.toLowerCase().includes(filter))
                )
              );
              return [category, filteredHandlers] as [
                string,
                Set<CommandHandler>
              ];
            })
            .filter(([_, handlers]) => handlers.size > 0);

          // For categories that match by name, include all their commands
          categoryMatches.forEach(([matchedCategory]) => {
            const existingMatch = commandMatches.find(
              ([category]) => category === matchedCategory
            );
            if (!existingMatch) {
              // If this category isn't already in commandMatches, add it with all its commands
              const categoryEntry = categoryEntries.find(
                ([category]) => category === matchedCategory
              );
              if (categoryEntry) {
                commandMatches.push(categoryEntry);
              }
            }
          });

          filteredCategories = commandMatches;
        }

        // Calculate pagination
        const totalPages = Math.ceil(filteredCategories.length / pageSize);
        page = Math.max(1, Math.min(page, totalPages || 1));

        const startIdx = (page - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, filteredCategories.length);
        const paginatedCategories = filteredCategories.slice(startIdx, endIdx);

        // Generate help text
        let helpText = Styles(`🤖 ${config.nameBot}\n\n`);

        if (filter) {
          helpText += Styles(`🔍 *Search results for: ${filter}*\n\n`);
        }

        if (paginatedCategories.length === 0) {
          helpText += "No commands found.\n";
        } else {
          paginatedCategories.forEach(([category, handlers]) => {
            helpText += Styles(`🏷️ *${category}*\n`);
            handlers.forEach((handler) => {
              const aliases = "*" + handler.commands.join(" | ") + "*";
              helpText += `➤ ${aliases}\n`;
            });
            helpText += "\n";
          });
        }

        // Add pagination info
        if (totalPages > 1) {
          helpText += Styles(`📄 *Page ${page}/${totalPages}*\n`);
          helpText += `Use *help <page>* to view more commands\n`;
        }

        if (!filter) {
          helpText += `Use *help <search terms>* to filter commands\n`;
        }

        await message.reply({
          text: helpText,
          contextInfo: {
            externalAdReply: {
              title: config.nameBot,
              body: config.wm,
              thumbnailUrl: config.thumbnailUrl,
              sourceUrl: null,
              mediaType: 1,
              renderLargerThumbnail: true,
            },
          },
        });
      },
    },
    {
      commands: ["detail", "info"],
      description: "Show detailed information about a specific command",
      async handler(_: any, message: SerializedMessage, args: string[]) {
        if (!args.length) {
          await message.reply(
            "Please specify a command to get detailed information."
          );
          return;
        }

        const commandName = args[0].toLowerCase();
        const commands = pluginLoader.getCommands();
        const handler = commands.get(commandName);

        if (!handler) {
          // Try to find command as an alias
          let foundHandler: CommandHandler | undefined;
          for (const [_, cmdHandler] of commands.entries()) {
            if (
              cmdHandler.commands.some(
                (cmd) => cmd.toLowerCase() === commandName
              )
            ) {
              foundHandler = cmdHandler;
              break;
            }
          }

          if (!foundHandler) {
            await message.reply(
              `Command *${commandName}* not found. Use *help* to see available commands.`
            );
            return;
          }

          // Use the found handler
          let detailText = Styles(`📝 *Command Details: ${commandName}*\n\n`);
          detailText += `🏷️: ${foundHandler.category || "General"}\n`;
          detailText += `${foundHandler.commands.join(" | ")}\n`;
          detailText += `\n${
            foundHandler.description || "No description available"
          }\n`;

          await message.reply({
            text: detailText,
            contextInfo: {
              externalAdReply: {
                title: config.nameBot,
                body: config.wm,
                thumbnailUrl: config.thumbnailUrl,
                sourceUrl: null,
                mediaType: 1,
                renderLargerThumbnail: true,
              },
            },
          });
          return;
        }

        let detailText = Styles(`📝 *Command Details: ${commandName}*\n\n`);
        detailText += `🏷️ ${handler.category || "General"}\n`;
        detailText += `*${handler.commands.join(" | ")}*\n`;
        detailText += `${handler.description || "No description available"}\n`;

        await message.reply({
          text: detailText,
          contextInfo: {
            externalAdReply: {
              title: config.nameBot,
              body: config.wm,
              thumbnailUrl: config.thumbnailUrl,
              sourceUrl: null,
              mediaType: 1,
              renderLargerThumbnail: true,
            },
          },
        });
      },
    },
  ],
});
