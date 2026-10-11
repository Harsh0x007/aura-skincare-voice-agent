
import express from "express";
import { generateSpeech } from "../services/ttsService.js";

const router = express.Router();

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
