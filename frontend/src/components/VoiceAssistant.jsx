
import {
    Headphones,
    Phone,
    PhoneOff,
    ArrowUpRight,
    Mic,
    CircleAlert,
} from "lucide-react";

export default function VoiceAssistant({
    callState,
    stateLabel,
    startCall,
    endCall,
    typedMessage,
    setTypedMessage,
    submitTypedMessage,
    error,
}) {
    return (
        <div className="call-card">
            <div className="card-topline">
                <span className="mini-label">VOICE SUPPORT</span>
                <span className={`state-pill ${callState}`}>
                    <span className="state-dot" />
                    {stateLabel}
                </span>
            </div>

            <div className={`aria-orb ${callState}`}>
                <div className="orb-inner">
                    <Headphones size={34} />
                </div>
                <span className="orb-ring ring-one" />
                <span className="orb-ring ring-two" />
            </div>

            <h2>Hi, I'm Aria.</h2>

            <p className="call-subtitle">
                {callState === "idle"
                    ? "I'm here to make things simple. What can I help you with today?"
                    : callState === "listening"
                        ? "I'm listening. Go ahead."
                        : callState === "thinking"
                            ? "One moment while I check that for you…"
                            : "I'm speaking. You can interrupt me anytime."}
            </p>

            <div className="waveform" aria-label={stateLabel}>
                {Array.from({ length: 31 }, (_, i) => (
                    <span
                        key={i}
                        style={{ "--i": i }}
                        className={
                            callState === "speaking" || callState === "listening"
                                ? "active"
                                : ""
                        }
                    />
                ))}
            </div>

            <div className="call-actions">
                <button
                    className="start-button"
                    onClick={startCall}
                    disabled={callState !== "idle"}
                >
                    <Phone size={17} fill="currentColor" /> Start call
                </button>

                <button
                    className="end-button"
                    onClick={endCall}
                    disabled={callState === "idle"}
                >
                    <PhoneOff size={16} /> End call
                </button>
            </div>

            <form
                className="lookup-form"
                onSubmit={submitTypedMessage}
                style={{ marginTop: "14px" }}
            >
                <label htmlFor="chat-message">Or type a message to Aria</label>
                <div className="lookup-row">
                    <input
                        id="chat-message"
                        value={typedMessage}
                        onChange={(e) => setTypedMessage(e.target.value)}
                        placeholder="Ask about ORD-101 or returns"
                    />
                    <button
                        type="submit"
                        aria-label="Send message"
                        disabled={!typedMessage.trim()}
                    >
                        <ArrowUpRight size={17} />
                    </button>
                </div>
            </form>

            <div className="mic-note">
                <Mic size={13} /> Microphone permission is required for voice
                <span>·</span> Use headphones for best results
            </div>

            {error && (
                <div className="error-banner">
                    <CircleAlert size={16} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
