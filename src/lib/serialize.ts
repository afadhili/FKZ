import {
  proto,
  WASocket,
  downloadContentFromMessage,
  AnyMessageContent,
} from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { escapeRegExp } from "./functions";

// Define types for serialized message
export interface SerializedMessage {
  /** The message ID */
  id: string;
  /** Whether the message was sent by the current user */
  fromMe: boolean;
  /** The sender's JID (WhatsApp ID) */
  sender: {
    /** The full JID of the sender */
    jid: string;
    /** The name of the sender (if available) */
    name?: string;
    /** Whether the message is from a group */
    isGroup: boolean;
    /** The group participant who sent the message (if in a group) */
    participant?: string;
  };
  /** The message content */
  message: {
    /** The raw message object from WhatsApp */
    raw: proto.IWebMessageInfo;
    /** The message type (text, image, video, etc.) */
    type: string;
    /** The message text content */
    text: string;
    /** The message caption (for media messages) */
    caption?: string;
    /** The quoted message (if any) */
    quoted?: SerializedMessage;
    /** Whether the message mentions everyone in a group */
    mentionedJids?: string[];
    /** Whether the message mentions everyone in a group */
    mentionedEveryone: boolean;
    /** The message timestamp */
    timestamp: number;
    /** The message prefix (if any) */
    prefix?: string;
    /** The command in the message (if any) */
    command?: string;
    /** The command arguments */
    args?: string[];
  };
  /** The chat where the message was sent */
  chat: {
    /** The chat JID */
    jid: string;
    /** Whether the chat is a group */
    isGroup: boolean;
    /** The chat name (if available) */
    name?: string;
  };
  /** Helper function to reply to the message */
  reply: (
    text: string | AnyMessageContent,
    options?: object
  ) => Promise<proto.WebMessageInfo | undefined>;
  /** Helper function to react to the message */
  react: (emoji: string) => Promise<proto.WebMessageInfo | undefined>;
  /** Helper function to download media from the message */
  downloadMedia: () => Promise<Buffer | string | null>;
}

/**
 * Serializes a WhatsApp message for easier handling
 * @param sock - The WhatsApp socket connection
 * @param m - The message to serialize
 * @returns A serialized message object
 */
export function serialize(
  sock: WASocket,
  m: proto.IWebMessageInfo
): SerializedMessage | null {
  if (!m) return null;

  // Extract basic information
  const content = m.message || {};
  const messageID = m.key.id || "";
  const senderJid = m.key.remoteJid || "";
  const fromMe = m.key.fromMe || false;
  const isGroup = senderJid?.endsWith("@g.us") || false;
  const participant = isGroup ? m.key.participant : undefined;
  const timestamp = m.messageTimestamp as number;
  const quotedMsg =
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage || undefined;
  const quotedStanzaId =
    m.message?.extendedTextMessage?.contextInfo?.stanzaId || undefined;
  const quotedParticipant =
    m.message?.extendedTextMessage?.contextInfo?.participant || undefined;

  // Determine message type and extract text content
  let messageType = Object.keys(content)[0] || "conversation";
  let messageText = "";
  let caption = "";

  // Extract text based on message type
  if (content.conversation) {
    messageText = content.conversation;
  } else if (content.extendedTextMessage) {
    messageText = content.extendedTextMessage.text || "";
  } else if (content.imageMessage) {
    messageType = "imageMessage";
    messageText = "";
    caption = content.imageMessage.caption || "";
  } else if (content.videoMessage) {
    messageType = "videoMessage";
    messageText = "";
    caption = content.videoMessage.caption || "";
  } else if (content.documentMessage) {
    messageType = "documentMessage";
    messageText = "";
    caption = content.documentMessage.caption || "";
  } else if (content.audioMessage) {
    messageType = "audioMessage";
    messageText = "";
  } else if (content.stickerMessage) {
    messageType = "stickerMessage";
    messageText = "";
  }

  // Check for mentions
  const mentionedJids =
    content.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const mentionedEveryone =
    messageText.includes("@everyone") || messageText.includes("@all");

  // Extract message body (text or caption)
  const body = messageText || caption || "";

  // Extract prefix and command
  const prefix = new RegExp("^[°•π÷×¶∆£¢€¥®™+✓=|/~!?@#%^&.©^]", "gi").test(body)
    ? body.match(new RegExp("^[°•π÷×¶∆£¢€¥®™+✓=|/~!?@#%^&.©^]", "gi"))?.[0] ||
      ""
    : "";

  const command = prefix
    ? body.trim().replace(prefix, "").trim().split(/ +/).shift() || ""
    : "";
  const args =
    body
      .trim()
      .replace(new RegExp("^" + escapeRegExp(prefix), "i"), "")
      .replace(command, "")
      .split(/ +/)
      .filter((a) => a) || [];

  // Create serialized message object
  const serialized: SerializedMessage = {
    id: messageID,
    fromMe,
    sender: {
      jid: senderJid,
      isGroup,
      participant: participant || undefined,
      name: m.pushName || undefined,
    },
    message: {
      raw: m,
      type: messageType,
      text: messageText,
      caption,
      mentionedJids,
      mentionedEveryone,
      timestamp,
      prefix,
      command,
      args,
      quoted: undefined, // Will be set later if a quoted message exists
    },
    chat: {
      jid: senderJid,
      isGroup,
    },
    // Helper function to reply to this message
    reply: async (text: string | AnyMessageContent, options = {}) => {
      if (typeof text === "string") {
        return await sock.sendMessage(
          senderJid,
          { text, ...options },
          { quoted: m, ephemeralExpiration: timestamp, ...options }
        );
      } else if (typeof text === "object" && typeof text !== "string") {
        return await sock.sendMessage(
          senderJid,
          { ...text, ...options },
          { quoted: m, ephemeralExpiration: timestamp, ...options }
        );
      }
    },
    // Helper function to react to this message
    react: async (emoji: string) => {
      return await sock.sendMessage(senderJid, {
        react: {
          text: emoji,
          key: m.key,
        },
      });
    },
    // Helper function to download media from this message
    downloadMedia: async () => {
      try {
        // Check if message contains media
        if (!content) return null;

        let buffer: Buffer | null = null;
        let stream;
        let mimetype = "";
        let filename = "";

        // Handle different media types
        if (content.imageMessage) {
          stream = await downloadContentFromMessage(
            content.imageMessage,
            "image"
          );
          mimetype = content.imageMessage.mimetype || "image/jpeg";
          filename = `image-${Date.now()}.${mimetype.split("/")[1]}`;
        } else if (content.videoMessage) {
          stream = await downloadContentFromMessage(
            content.videoMessage,
            "video"
          );
          mimetype = content.videoMessage.mimetype || "video/mp4";
          filename = `video-${Date.now()}.${mimetype.split("/")[1]}`;
        } else if (content.audioMessage) {
          stream = await downloadContentFromMessage(
            content.audioMessage,
            "audio"
          );
          mimetype = content.audioMessage.mimetype || "audio/mpeg";
          filename = `audio-${Date.now()}.${mimetype.split("/")[1]}`;
        } else if (content.documentMessage) {
          stream = await downloadContentFromMessage(
            content.documentMessage,
            "document"
          );
          mimetype =
            content.documentMessage.mimetype || "application/octet-stream";
          filename =
            content.documentMessage.fileName || `document-${Date.now()}`;
        } else if (content.stickerMessage) {
          stream = await downloadContentFromMessage(
            content.stickerMessage,
            "sticker"
          );
          mimetype = content.stickerMessage.mimetype || "image/webp";
          filename = `sticker-${Date.now()}.webp`;
        } else {
          // No media found
          return null;
        }

        // Download the media
        if (stream) {
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          buffer = Buffer.concat(chunks);

          // Create media directory if it doesn't exist
          const mediaDir = path.join(process.cwd(), "media");
          if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
          }

          // Save the file
          const filePath = path.join(mediaDir, filename);
          fs.writeFileSync(filePath, buffer);

          return filePath; // Return the file path
        }

        return null;
      } catch (error) {
        console.error("Error downloading media:", error);
        return null;
      }
    },
  };

  // Process quoted message if it exists
  if (quotedMsg && quotedStanzaId) {
    // Create a simplified WebMessageInfo for the quoted message
    const quotedMsgObj: proto.IWebMessageInfo = {
      key: {
        remoteJid: senderJid,
        fromMe: false,
        id: quotedStanzaId,
        participant: quotedParticipant,
      },
      message: quotedMsg,
      messageTimestamp: 0, // We don't have the exact timestamp of the quoted message
    };

    // Recursively serialize the quoted message
    const quotedSerialized = serialize(sock, quotedMsgObj);

    // Attach the quoted message to the serialized message
    if (quotedSerialized) {
      serialized.message.quoted = quotedSerialized;
    }
  }

  return serialized;
}
