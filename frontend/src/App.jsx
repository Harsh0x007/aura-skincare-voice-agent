import { useEffect, useRef, useState } from "react";
import { Leaf, Sparkles, ArrowUpRight } from "lucide-react";
import AuthForm from "./components/AuthForm";
import OrderPanel from "./components/OrderPanel";
import CallSummary from "./components/CallSummary";
import VoiceAssistant from "./components/VoiceAssistant";

const fallbackOrders = [
  { order_id: "ORD-101", customer: "Priya Sharma", product: "Vitamin C Serum (30ml)", value: 699, status: "Out for Delivery", carrier: "BlueDart", tracking_id: "BD-982103", notes: "Expected by 6 PM today" },
  { order_id: "ORD-102", customer: "Rahul Verma", product: "Hydrating Sunscreen SPF 50", value: 499, status: "Delivered", carrier: "Delhivery", tracking_id: "DL-441029", notes: "Delivered 14 days ago" },
  { order_id: "ORD-103", customer: "Ananya Patel", product: "Green Tea Face Wash + Toner", value: 850, status: "Processing", notes: "Ordered 3 hours ago. Eligible for cancellation" }
];

export default function App() {
  const [callState, setCallState] = useState("idle");
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [orders, setOrders] = useState(fallbackOrders);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [typedMessage, setTypedMessage] = useState("");
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const busyRef = useRef(false);
  const transcriptRef = useRef([]);
  const speakingRef = useRef(false);
  const interruptRecognitionRef = useRef(null);
  const speechResolveRef = useRef(null);


  useEffect(() => {
    async function restoreLogin() {
      const token = localStorage.getItem("aura_token");

      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem("aura_token");
          setUser(null);
          return;
        }

        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error("Could not restore login:", error);
      } finally {
        setAuthChecking(false);
      }
    }

    restoreLogin();
  }, []);



  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const isRegister = authMode === "register";

      const response = await fetch(
        `/api/auth/${isRegister ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isRegister ? { name: authName } : {}),
            email: authEmail,
            password: authPassword
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      localStorage.setItem("aura_token", data.token);
      setUser(data.user);
      setAuthPassword("");
      setAuthError("");
    } catch (error) {
      setAuthError(error.message || "Could not connect to the backend.");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/orders").then(r => r.ok ? r.json() : fallbackOrders).then(setOrders).catch(() => setOrders(fallbackOrders));
    return () => { shouldListenRef.current = false; try { recognitionRef.current?.stop(); } catch { } window.speechSynthesis?.cancel(); };
  }, []);

  function addTranscript(role, text) {
    if (!text?.trim()) return;
    const item = { role, text: text.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    transcriptRef.current = [...transcriptRef.current, item];
    setTranscript([...transcriptRef.current]);
  }

  function stopListening() {
    shouldListenRef.current = false;
    try { recognitionRef.current?.stop(); } catch { }
  }

  function beginListening() {
    if (!shouldListenRef.current || busyRef.current) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please use Google Chrome or type a message below.");
      setCallState("listening");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;
      recognition.onstart = () => setCallState("listening");
      recognition.onresult = async event => {
        const spoken = event.results?.[event.results.length - 1]?.[0]?.transcript?.trim();
        if (spoken) await sendMessage(spoken);
      };
      recognition.onerror = event => {
        if (event.error !== "no-speech" && event.error !== "aborted") setError(`Microphone error: ${event.error}. You can type your message instead.`);
      };
      recognition.onend = () => {
        if (shouldListenRef.current && !busyRef.current) setTimeout(() => beginListening(), 250);
      };
      recognition.start();
    } catch (e) {
      setError("Could not start speech recognition. Check microphone permission or type a message instead.");
      setCallState("listening");
    }
  }

  async function sendMessage(rawMessage) {
    const message = String(rawMessage || "").trim();
    if (!message || busyRef.current) return;
    busyRef.current = true;
    try { recognitionRef.current?.stop(); } catch { }
    setError("");
    addTranscript("customer", message);
    setCallState("thinking");
    const history = transcriptRef.current.slice(0, -1).map(item => ({ role: item.role === "aria" ? "assistant" : "user", content: item.text }));
    try {

      const token = localStorage.getItem("aura_token");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message, history })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not get an AI response.");
      const reply = data.reply || "I'm sorry, I couldn't prepare a response. Please try again.";
      addTranscript("aria", reply);
      setCallState("speaking");
      await speak(reply);
    } catch (e) {
      const msg = e.message || "Could not reach the local AI.";
      setError(msg);
      addTranscript("aria", "I'm sorry, I'm having trouble answering right now. Please try again.");
    } finally {
      busyRef.current = false;
      if (shouldListenRef.current) beginListening();
      else setCallState("idle");
    }
  }


  async function speak(text) {
    const safeText = String(text || "").trim();
    if (!safeText) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    speakingRef.current = true;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: safeText }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate AI voice");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      try {
        await new Promise((resolve, reject) => {
          audio.onended = resolve;
          audio.onerror = () => reject(new Error("Audio playback failed"));

          audio.play().catch(reject);
        });
      } finally {
        audio.pause();
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.error("Aura voice error:", error);
    } finally {
      speakingRef.current = false;
    }
  }

  async function startCall() {
    setError(""); setSummary(null); setTranscript([]); transcriptRef.current = [];
    shouldListenRef.current = true;
    setCallState("thinking");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) setError("This browser may not support voice recognition. You can still use the message box below.");
    addTranscript("aria", "Hello! I'm Aria from Aura Skincare. How can I help you today?");
    await speak("Hello! I'm Aria from Aura Skincare. How can I help you today?");
    if (shouldListenRef.current) beginListening();
  }

  function endCall() {
    stopListening();
    window.speechSynthesis?.cancel();
    busyRef.current = false;
    setCallState("idle");
    const customerText = transcriptRef.current.filter(x => x.role === "customer").map(x => x.text).join(" ");
    const agentText = transcriptRef.current.filter(x => x.role === "aria").map(x => x.text).join(" ");
    const combined = `${customerText} ${agentText}`.toLowerCase();
    const orderId = combined.match(/ord[- ]?10[123]/i)?.[0]?.toUpperCase().replace(" ", "-") || null;
    let intent = "GENERAL_SUPPORT";
    if (/order|deliver|tracking|where is/.test(combined)) intent = "ORDER_TRACKING";
    if (/return|refund|unopened|defective|damaged/.test(combined)) intent = "RETURNS_REFUNDS";
    if (/cancel|cancellation/.test(combined)) intent = "CANCELLATION";
    const resolved = transcriptRef.current.some(x => x.role === "customer") && transcriptRef.current.some(x => x.role === "aria");
    setSummary({ customer_intent: intent, order_id: orderId, resolution_status: resolved ? "ATTEMPTED" : "NEEDS_REVIEW", call_summary: customerText ? `Customer said: ${customerText.slice(0, 260)}${customerText.length > 260 ? "…" : ""}` : "No customer transcript was captured.", agent_response_excerpt: agentText.slice(-400) });
  }

  async function submitTypedMessage(e) { e.preventDefault(); const message = typedMessage; setTypedMessage(""); await sendMessage(message); }

  async function lookupOrder(e) {
    e.preventDefault(); setLookupResult(null); setError("");
    try {
      const res = await fetch("/api/orders/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: lookupId }) });
      const data = await res.json();
      setLookupResult(res.ok ? data : { error: data.error || "Order not found" });
    } catch { setLookupResult({ error: "Backend is not running. Start the backend terminal first." }); }
  }

  const stateLabel = { idle: "Ready to connect", listening: "Listening", thinking: "Thinking", speaking: "Speaking" }[callState];
  if (authChecking) {
    return <div className="loading-screen">Loading your session...</div>;
  }

  if (!user) {
    return <AuthForm onLogin={setUser} />;
  }
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Leaf size={20} /></span><span>AURA <small>SKINCARE</small></span></a>
      <div className="top-meta"><span className="online-dot" /> AI CUSTOMER CARE <span className="top-divider" /> DEMO ENVIRONMENT</div>
      <button className="help-button" onClick={() => window.open("https://www.aad.org/public/everyday-care/skin-care-basics", "_blank")}><span>Skin care guide</span><ArrowUpRight size={15} /></button>
    </header>

    <main>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14} /> YOUR PERSONAL SKINCARE ASSISTANT</div>
        <h1>A little care.<br /><em>A lot of confidence.</em></h1>
        <p className="hero-copy">Meet Aria, your Aura support specialist. Ask about your order, our products, delivery, or returns — just speak naturally.</p>
      </section>


      <section className="workspace">
        <div className="main-column">
          <VoiceAssistant
            callState={callState}
            stateLabel={stateLabel}
            startCall={startCall}
            endCall={endCall}
            typedMessage={typedMessage}
            setTypedMessage={setTypedMessage}
            submitTypedMessage={submitTypedMessage}
            error={error}
          />
          <CallSummary transcript={transcript} summary={summary} />
        </div>

        <OrderPanel
          orders={orders}
          lookupOrder={lookupOrder}
          lookupId={lookupId}
          setLookupId={setLookupId}
          lookupResult={lookupResult}
        />
      </section>

    </main>
    <footer><div className="footer-brand"><Leaf size={15} /> AURA SKINCARE</div><span>Thoughtful care, every conversation.</span><span className="footer-demo">Assessment demo · Mock order data</span></footer>

  </div>;
}
