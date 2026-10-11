
import { Volume2, Leaf, CheckCircle2 } from "lucide-react";

export default function CallSummary({ transcript, summary }) {
    const copyReport = () => {
        navigator.clipboard?.writeText(
            JSON.stringify({ transcript, summary }, null, 2)
        );
    };

    return (
        <>
            <div className="panel transcript-panel">
                <div className="panel-heading">
                    <div>
                        <span className="mini-label">LIVE CONVERSATION</span>
                        <h3>Call transcript</h3>
                    </div>
                    <span className="count-chip">
                        {transcript.length} messages
                    </span>
                </div>

                <div className="transcript-body">
                    {transcript.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <Volume2 size={20} />
                            </div>
                            <strong>Your conversation will appear here</strong>
                            <p>
                                Start a call and talk to Aria. Your transcript
                                will be collected as you speak.
                            </p>
                        </div>
                    ) : (
                        transcript.map((line, i) => (
                            <div
                                className={`message ${line.role}`}
                                key={i}
                            >
                                <div className="message-avatar">
                                    {line.role === "aria" ? (
                                        <Leaf size={14} />
                                    ) : (
                                        "Y"
                                    )}
                                </div>

                                <div className="message-content">
                                    <div className="message-meta">
                                        <strong>
                                            {line.role === "aria" ? "Aria" : "You"}
                                        </strong>
                                        <time>{line.time}</time>
                                    </div>
                                    <p>{line.text}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {summary && (
                <div className="panel summary-panel">
                    <div className="panel-heading">
                        <div>
                            <span className="mini-label">POST-CALL REPORT</span>
                            <h3>Call summary</h3>
                        </div>
                        <CheckCircle2 size={20} color="#4b7659" />
                    </div>

                    <pre>{JSON.stringify(summary, null, 2)}</pre>

                    <button className="copy-button" onClick={copyReport}>
                        Copy transcript + JSON
                    </button>
                </div>
            )}
        </>
    );
}
