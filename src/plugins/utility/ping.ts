import { SerializedMessage } from "../../lib/serialize";

export default () => ({
  info: {
    name: "Ping Plugin",
    description: "Basic ping-pong command",
  },
  commands: [
    {
      commands: ["ping", "pong"],
      description: "Check if bot is responsive",
      async handler(_: any, message: SerializedMessage) {
        await message.reply("🏓 Pong!");
      },
    },
  ],
});
