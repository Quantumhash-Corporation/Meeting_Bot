// src/lib/ftpUploader.ts
import { Client } from "basic-ftp";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function uploadAudioToFTP(
  localFilePath: string,
  subDir = "recordings"
): Promise<string> {

  // 🔒 Safety check
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Audio file not found: ${localFilePath}`);
  }

  const client = new Client();
  client.ftp.timeout = 10 * 60 * 1000; // 10 min

  const fileName = path.basename(localFilePath);
  const uniqueName = `${Date.now()}-${uuidv4()}-${fileName}`;

  try {
    // 🔌 Connect
    await client.access({
      host: process.env.FTP_HOST!,
      user: process.env.FTP_USER!,
      password: process.env.FTP_PASS!,
      port: Number(process.env.FTP_PORT || 21),
      secure: process.env.FTP_SECURE === "true",
    });

    const remoteDir = path.posix.join(
      process.env.FTP_REMOTE_DIR || "/",
      subDir
    );

    // 📂 Ensure directory
    await client.ensureDir(remoteDir);
    await client.cd(remoteDir);

    // 📤 Upload
    await client.uploadFrom(localFilePath, uniqueName);

    // 🌐 Public URL
    const publicUrl =
      `${process.env.FTP_BASE_URL}/${subDir}/${uniqueName}`;

    return publicUrl;

  } catch (err: any) {
    console.error("❌ FTP upload error:", err.message);
    throw err;
  } finally {
    client.close();
  }
}