
import express from "express";
import { generateSpeech } from "../services/ttsService.js";

const router = express.Router();

const GREETING =
    "Hello! I'm Aria from Aura Skincare. How can I help you today?";

let greetingAudioPromise = null;

function getGreetingAudio() {
    if (!greetingAudioPromise) {
        greetingAudioPromise = generateSpeech(GREETING).catch((error) => {
            greetingAudioPromise = null;
            throw error;
        });
    }

    return greetingAudioPromise;
}

// Generate the greeting in the background when the server starts.
getGreetingAudio().catch((error) => {
    console.error("Greeting audio prewarm failed:", error.message);
});

router.get("/greeting", async (req, res) => {
    try {
        const audio = await getGreetingAudio();

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");

        return res.send(audio);
    } catch (error) {
        console.error("Greeting TTS error:", error.message);
        return res.status(500).json({
            error: "Could not generate greeting audio."
        });
    }
});

router.post("/", async (req, res) => {
    try {
        const { text } = req.body;

        if (typeof text !== "string" || !text.trim() || text.length > 5000) {
            return res.status(400).json({
                error: "Please provide valid text under 5000 characters."
            });
        }

        const audio = await generateSpeech(text);

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");

        return res.send(audio);
    } catch (error) {
        console.error("TTS error:", error.message);
        return res.status(500).json({
            error: "Could not generate speech."
        });
    }
});

export default router;
