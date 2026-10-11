
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink, readFile } from "node:fs/promises";

export function generateSpeech(text) {
    return new Promise((resolve, reject) => {
        const safeText = String(text || "").trim();

        if (!safeText) {
            reject(new Error("Speech text is empty"));
            return;
        }

        const pythonCode = `
import asyncio
import edge_tts
import sys

async def main():
    text = sys.stdin.read()
    communicate = edge_tts.Communicate(
        text,
        "en-IN-NeerjaNeural"
    )
    await communicate.save(sys.argv[1])

asyncio.run(main())
`;

        const outputPath = join(tmpdir(), `aura-${randomUUID()}.mp3`);
        const pythonCommand =
            process.env.PYTHON_COMMAND ||
            (process.platform === "win32" ? "py" : "python3");

        const child = spawn(pythonCommand, ["-c", pythonCode, outputPath]);

        let errorOutput = "";

        child.stderr.on("data", chunk => {
            errorOutput += chunk.toString();
        });

        child.on("error", error => {
            reject(error);
        });

        child.on("close", async code => {
            try {
                if (code !== 0) {
                    throw new Error(errorOutput || "Speech generation failed");
                }

                const audio = await readFile(outputPath);
                resolve(audio);
            } catch (error) {
                reject(error);
            } finally {
                await unlink(outputPath).catch(() => { });
            }
        });

        child.stdin.end(safeText);
    });
}
