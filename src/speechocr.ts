// src/speechocr.ts
import { environment, showToast, Toast, LocalStorage } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { execFileSync } from "child_process";
import path from "path";
import os from "os";

// Default speech rate if no setting is saved
const DEFAULT_RATE = 175;

// Load saved rate or fallback to default
async function getSpeechRate(): Promise<number> {
  const value = await LocalStorage.getItem<string>("speechRate");
  const parsed = parseInt(value || "");
  return isNaN(parsed) ? DEFAULT_RATE : parsed;
}

export default async function Command() {
  // 1) Run OCR via bundled Swift script
  let ocrText: string;
  try {
    const scriptPath = `${environment.assetsPath}/ocr.swift`;
    const stdout = execFileSync("/usr/bin/env", ["swift", scriptPath], {
      encoding: "utf8",
    });
    ocrText = stdout.trim();
  } catch (error: any) {
    await showToast({
      style: Toast.Style.Failure,
      title: "OCR Failed",
      message: error.message,
    });
    return;
  }

  if (!ocrText) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No Text Detected",
      message: "Try selecting a different area.",
    });
    return;
  }

  // 2) Load speed setting and create AIFF
  const rate = await getSpeechRate();
  const audioPath = path.join(os.tmpdir(), "raycast-ocr.aiff");

  try {
    execFileSync(
      "/usr/bin/env",
      ["say", "-r", rate.toString(), "-o", audioPath, ocrText],
      { encoding: "utf8" }
    );
  } catch (error: any) {
    await showToast({
      style: Toast.Style.Failure,
      title: "TTS Generation Failed",
      message: error.message,
    });
    return;
  }

  // 3) Open AIFF in QuickTime Player with play/pause UI
  const appleScript = `
    tell application "QuickTime Player"
      open POSIX file ${JSON.stringify(audioPath)}
      activate
      tell document 1 to play
    end tell
  `;
  try {
    await runAppleScript(appleScript);
    await showToast({
      style: Toast.Style.Success,
      title: `🔊 Speaking at ${rate} wpm`,
    });
  } catch (error: any) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Playback Failed",
      message: error.message,
    });
  }
}