import { useEffect, useRef, useState } from "react";
import { Leaf, Sparkles, ArrowUpRight } from "lucide-react";
import AuthForm from "./components/AuthForm";
import OrderPanel from "./components/OrderPanel";
import CallSummary from "./components/CallSummary";
import VoiceAssistant from "./components/VoiceAssistant";
import ProductShop from "./components/ProductShop";
import API_BASE_URL from "./api";

const fallbackOrders = [
  { order_id: "ORD-101", customer: "Priya Sharma", product: "Vitamin C Serum (30ml)", value: 699, status: "Out for Delivery", carrier: "BlueDart", tracking_id: "BD-982103", notes: "Expected by 6 PM today" },
  { order_id: "ORD-102", customer: "Rahul Verma", product: "Hydrating Sunscreen SPF 50", value: 499, status: "Delivered", carrier: "Delhivery", tracking_id: "DL-441029", notes: "Delivered 14 days ago" },
  { order_id: "ORD-103", customer: "Ananya Patel", product: "Green Tea Face Wash + Toner", value: 850, status: "Processing", notes: "Ordered 3 hours ago. Eligible for cancellation" }
];

export default function App() {
  const [callState, setCallState] = useState("idle");
  const [user, setUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activePage, setActivePage] = useState("assistant");
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

  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const speechRequestRef = useRef(0);
  const callSessionRef = useRef(0);


  useEffect(() => {
    async function restoreLogin() {
      const token = localStorage.getItem("aura_token");

      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
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
        `${API_BASE_URL}/api/auth/${isRegister ? "register" : "login"}`,
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

  function handleLogout() {
    stopListening();
    window.speechSynthesis?.cancel();

    localStorage.removeItem("aura_token");

    setUser(null);
    setTranscript([]);
    transcriptRef.current = [];
    setOrders([]);
    setSummary(null);
    setLookupResult(null);
    setError("");
    setAuthError("");
    setAuthMode("login");
  }


  useEffect(() => {
    async function loadOrders() {
      const token = localStorage.getItem("aura_token");

      if (!token) {
        setOrders([]);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/orders/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Could not load your orders.");
        }

        const data = await response.json();
        setOrders(data.orders || []);
      } catch (error) {
        console.error("Order loading error:", error);
        setOrders([]);
      }
    }

    if (user) {
      loadOrders();
    } else {
      setOrders([]);
    }

    return () => {
      shouldListenRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch { }
      window.speechSynthesis?.cancel();
    };
  }, [user]);

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
    const sessionId = callSessionRef.current;

    try {
      recognitionRef.current?.stop();
    } catch { }

    setError("");
    addTranscript("customer", message);
    setCallState("thinking");

    const history = transcriptRef.current
      .slice(0, -1)
      .map((item) => ({
        role: item.role === "aria" ? "assistant" : "user",
        content: item.text,
      }));

    try {
      const token = localStorage.getItem("aura_token");

      console.time("Aria: chat request");
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, history }),
      });
      console.timeEnd("Aria: chat request");

      // Ignore responses from a call that has already ended.
      if (sessionId !== callSessionRef.current) return;

      const responseText = await response.text();

      if (sessionId !== callSessionRef.current) return;

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Chat server returned an invalid response (HTTP ${response.status}). Check the backend terminal.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || `Chat request failed (HTTP ${response.status}).`
        );
      }

      if (sessionId !== callSessionRef.current) return;

      const reply =
        data.reply ||
        "I'm sorry, I couldn't prepare a response. Please try again.";

      console.log("Aria reply sent to voice:", reply);

      addTranscript("aria", reply);
      setCallState("speaking");

      if (sessionId !== callSessionRef.current) return;

      console.time("Aria: voice generation and playback");
      await speak(reply);
      console.timeEnd("Aria: voice generation and playback");
    } catch (error) {
      if (sessionId !== callSessionRef.current) return;

      setError(error.message || "Could not reach the local AI.");
      addTranscript(
        "aria",
        "I'm sorry, I'm having trouble answering right now. Please try again."
      );
    } finally {
      busyRef.current = false;

      // Never restart listening for an ended or replaced call.
      if (sessionId !== callSessionRef.current) return;

      if (shouldListenRef.current) {
        beginListening();
      } else {
        setCallState("idle");
      }
    }
  }




  function stopAriaAudio() {
    // Invalidate any audio request still being generated.
    speechRequestRef.current += 1;

    const audio = audioRef.current;
    const audioUrl = audioUrlRef.current;

    // Clear references first so another call can start safely.
    audioRef.current = null;
    audioUrlRef.current = null;
    speakingRef.current = false;

    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    // Resolve any playback promise waiting for audio to finish.
    if (speechResolveRef.current) {
      const resolve = speechResolveRef.current;
      speechResolveRef.current = null;
      resolve();
    }
  }




  async function speak(text, isGreeting = false) {
    stopAriaAudio();

    const requestId = speechRequestRef.current;

    const safeText = String(text || "")
      .replace(/\bsuperscript\b/gi, "")
      .replace(/₹\s*([\d,]+(?:\.\d{1,2})?)/g, "$1 rupees")
      .replace(/\s+/g, " ")
      .trim();

    if (!safeText) return;

    speakingRef.current = true;

    // Use browser speech when server TTS fails.

    const speakWithBrowser = () =>
      new Promise((resolve) => {
        if (
          !("speechSynthesis" in window) ||
          !window.SpeechSynthesisUtterance
        ) {
          console.error("Browser speech synthesis is not supported.");
          resolve();
          return;
        }

        if (requestId !== speechRequestRef.current) {
          resolve();
          return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(safeText);
        utterance.lang = "en-IN";
        const voices = window.speechSynthesis.getVoices();
        const indianVoice =
        voices.find((voice) => voice.name === "Microsoft Heera - English (India)") ||
        voices.find((voice) => voice.name === "Microsoft Ravi - English (India)");

        if (indianVoice) {
          utterance.voice = indianVoice;
          utterance.lang = "en-IN";
        }
        utterance.rate = 1.5;
        utterance.pitch = 1;
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;

          if (speechResolveRef.current === finish) {
            speechResolveRef.current = null;
          }

          resolve();
        };

        utterance.onend = () => {
          console.log("Browser speech finished:", performance.now());
          finish();
        };

        utterance.onerror = (event) => {
          console.error("Browser speech error:", event.error);
          finish();
        };

        speechResolveRef.current = () => {
          window.speechSynthesis.cancel();
          finish();
        };

        console.log("Browser speech started:", performance.now());
        window.speechSynthesis.speak(utterance);
      });


    const ttsStartedAt = performance.now();

    try {
      if (requestId !== speechRequestRef.current) return;

      console.log("Aria TTS: using browser speech");

      await speakWithBrowser();
    } catch (error) {
      console.error("Aria browser speech error:", error);
    } finally {
      if (requestId === speechRequestRef.current) {
        speakingRef.current = false;
        speechResolveRef.current = null;

        const audio = audioRef.current;
        const audioUrl = audioUrlRef.current;

        audioRef.current = null;
        audioUrlRef.current = null;

        if (audio) {
          audio.onended = null;
          audio.onerror = null;
          audio.onpause = null;
          audio.pause();
        }

        if (audioUrl) URL.revokeObjectURL(audioUrl);
      }
    }

  }




  async function startCall() {
    callSessionRef.current += 1;
    stopAriaAudio();
    busyRef.current = false;
    setError("");
    setSummary(null);
    setTranscript([]);
    transcriptRef.current = [];

    shouldListenRef.current = true;
    setCallState("thinking");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "This browser may not support voice recognition. You can still use the message box below."
      );
    }

    const greeting =
      "Hello! I'm Aria from Aura Skincare. How can I help you today?";

    addTranscript("aria", greeting);

    await speak(greeting, true);

    if (shouldListenRef.current) beginListening();
  }


  function endCall() {
    callSessionRef.current += 1;
    stopAriaAudio();
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
    e.preventDefault();
    setLookupResult(null);
    setError("");

    const token = localStorage.getItem("aura_token");

    if (!token) {
      setLookupResult({ error: "Please log in to check your orders." });
      return;
    }

    const requestedId = lookupId.trim().toUpperCase();

    if (!requestedId) {
      setLookupResult({ error: "Please enter an order ID." });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/my`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load your orders.");
      }

      const matchedOrder = (data.orders || []).find(
        (order) => order.order_id.toUpperCase() === requestedId
      );

      setLookupResult(
        matchedOrder
          ? matchedOrder
          : { error: "No order with that ID was found in your account." }
      );
    } catch (error) {
      setLookupResult({
        error: error.message || "Could not connect to the backend.",
      });
    }
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
      <a className="brand" href="#">
        <span className="brand-mark"><Leaf size={20} /></span>
        <span>AURA <small>SKINCARE</small></span>
      </a>

      <div className="top-meta">
        <span className="online-dot" />
        AI CUSTOMER CARE
        <span className="top-divider" />
        DEMO ENVIRONMENT
      </div>

      <div className="header-actions">
        <button
          className="help-button"
          onClick={() =>
            window.open(
              "https://www.aad.org/public/everyday-care/skin-care-basics",
              "_blank"
            )
          }
        >
          <span>Skin care guide</span>
          <ArrowUpRight size={15} />
        </button>

        <div className="profile-container">
          <button
            className="profile-button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
          >
            <span className="profile-avatar">
              {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
            </span>
            <span className="profile-button-text">
              {user?.name || "My Profile"}
            </span>
          </button>

          {profileOpen && (
            <div className="profile-menu">
              <div className="profile-details">
                <strong>{user?.name || "Customer"}</strong>
                <span>{user?.email || ""}</span>
              </div>

              <button
                className="logout-button"
                onClick={handleLogout}
              >
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    <nav className="page-nav">
      <button
        className={activePage === "assistant" ? "active" : ""}
        onClick={() => setActivePage("assistant")}
      >
        AI Assistant
      </button>

      <button
        className={activePage === "shop" ? "active" : ""}
        onClick={() => setActivePage("shop")}
      >
        Shop
      </button>

      <button
        className={activePage === "orders" ? "active" : ""}
        onClick={() => setActivePage("orders")}
      >
        My Orders
      </button>
    </nav>



    <main>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14} /> YOUR PERSONAL SKINCARE ASSISTANT</div>
        <h1>A little care.<br /><em>A lot of confidence.</em></h1>
        <p className="hero-copy">Meet Aria, your Aura support specialist. Ask about your order, our products, delivery, or returns — just speak naturally.</p>
      </section>


      {activePage === "assistant" && (
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
      )}

      {activePage === "shop" && (
        <ProductShop
          onOrderPlaced={async () => {
            const token = localStorage.getItem("aura_token");
            const response = await fetch(`${API_BASE_URL}/api/orders/my`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error("Could not refresh your orders.");
            }

            const data = await response.json();
            setOrders(data.orders || []);
            setLookupResult(null);
          }}
        />
      )}

      {activePage === "orders" && (
        <section className="workspace orders-page">
          <OrderPanel
            orders={orders}
            lookupOrder={lookupOrder}
            lookupId={lookupId}
            setLookupId={setLookupId}
            lookupResult={lookupResult}
          />
        </section>
      )}




    </main>
    <footer><div className="footer-brand"><Leaf size={15} /> AURA SKINCARE</div><span>Thoughtful care, every conversation.</span><span className="footer-demo">Assessment demo · Mock order data</span></footer>

  </div>;
}
