import axios, { AxiosResponse } from "axios";
import { fileURLToPath } from "url";
import { unwatchFile, watchFile } from "fs";
import path from "path";

/**
 * Escapes special characters in a string for use in a regular expression
 * @param string - The string to escape
 * @returns The escaped string
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, "\\$&");
}

/**
 * Creates a promise that resolves after the specified time
 * @param ms - The time to sleep in milliseconds
 * @returns A promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets the MIME type of a URL
 * @param url - The URL to get the MIME type from
 * @returns A promise that resolves to the MIME type
 */
export function getMime(url: string): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    try {
      const res: AxiosResponse = await axios.head(url);
      resolve(res.headers["content-type"] as string);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Gets the size of a URL in bytes
 * @param url - The URL to get the size from
 * @returns A promise that resolves to the size in bytes
 */
export function getSize(url: string): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    try {
      const res: AxiosResponse = await axios.head(url);
      resolve(res.headers["content-length"] as string);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Converts bytes to a human-readable size
 * @param bytes - The size in bytes
 * @returns A human-readable size string
 */
export function byteToSize(bytes: number): string {
  const sizes: string[] = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes == 0) return "0 Byte";
  const i: number = parseInt(
    Math.floor(Math.log(bytes) / Math.log(1024)).toString()
  );
  return Math.round(bytes / Math.pow(1024, i)) + " " + sizes[i];
}

/**
 * Fetches a buffer from a URL
 * @param url - The URL to fetch
 * @returns A promise that resolves to the buffer
 */
export function fetchbuffer(url: string): Promise<Buffer> {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const res: AxiosResponse<Buffer> = await axios.get(url, {
        responseType: "arraybuffer",
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
      });
      resolve(res.data);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Style mapping for text conversion
 */
interface StyleMap {
  [key: number]: string;
}

/**
 * Replacer object for character conversion
 */
interface Replacer {
  original: string;
  convert: string;
}

/**
 * Converts text to a stylized format
 * @param text - The text to convert
 * @param style - The style to use (default: 1)
 * @returns The stylized text
 */
export const Styles = (text: string, style: number = 1): string => {
  const xStr: string[] = "abcdefghijklmnopqrstuvwxyz1234567890".split("");
  const yStr: StyleMap = {
    1: "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ1234567890",
  };
  const replacer: Replacer[] = [];
  xStr.map((v, i) =>
    replacer.push({
      original: v,
      convert: yStr[style].split("")[i],
    })
  );
  const str: string[] = text.toLowerCase().split("");
  const output: string[] = [];
  str.map((v) => {
    const find = replacer.find((x) => x.original == v);
    find ? output.push(find.convert) : output.push(v);
  });
  return output.join("");
};

const fileP: string = __filename;
watchFile(fileP, () => {
  unwatchFile(fileP);
  console.log(`Successfully To Update File ${fileP}`);
});
