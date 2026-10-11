import { useEffect, useRef, useState } from "react";
import { Headphones, Leaf, Mic, Phone, PhoneOff, Package, Truck, CheckCircle2, CircleAlert, Sparkles, ArrowUpRight, Volume2 } from "lucide-react";

const fallbackOrders = [
  { order_id:"ORD-101", customer:"Priya Sharma", product:"Vitamin C Serum (30ml)", value:699, status:"Out for Delivery", carrier:"BlueDart", tracking_id:"BD-982103", notes:"Expected by 6 PM today" },
  { order_id:"ORD-102", customer:"Rahul Verma", product:"Hydrating Sunscreen SPF 50", value:499, status:"Delivered", carrier:"Delhivery", tracking_id:"DL-441029", notes:"Delivered 14 days ago" },
  { order_id:"ORD-103", customer:"Ananya Patel", product:"Green Tea Face Wash + Toner", value:850, status:"Processing", notes:"Ordered 3 hours ago. Eligible for cancellation" }
];

export default function App() {
  const [callState, setCallState] = useState("idle");
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

  useEffect(() => {
    fetch("/api/orders").then(r => r.ok ? r.json() : fallbackOrders).then(setOrders).catch(() => setOrders(fallbackOrders));
    return () => { shouldListenRef.current = false; try { recognitionRef.current?.stop(); } catch {} window.speechSynthesis?.cancel(); };
  }, []);

  function addTranscript(role, text) {
    if (!text?.trim()) return;
    const item = { role, text: text.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    transcriptRef.current = [...transcriptRef.current, item];
    setTranscript([...transcriptRef.current]);
  }

  function stopListening() {
    shouldListenRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
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
    try { recognitionRef.current?.stop(); } catch {}
    setError("");
    addTranscript("customer", message);
    setCallState("thinking");
    const history = transcriptRef.current.slice(0, -1).map(item => ({ role:item.role === "aria" ? "assistant" : "user", content:item.text }));
    try {
      const response = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ message, history }) });
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

  function speak(text) {
    return new Promise(resolve => {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      utterance.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = voices.find(v => /en-IN/i.test(v.lang));
      if (indianVoice) utterance.voice = indianVoice;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
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
    setSummary({ customer_intent:intent, order_id:orderId, resolution_status:resolved ? "ATTEMPTED" : "NEEDS_REVIEW", call_summary:customerText ? `Customer said: ${customerText.slice(0,260)}${customerText.length > 260 ? "…" : ""}` : "No customer transcript was captured.", agent_response_excerpt:agentText.slice(-400) });
  }

  async function submitTypedMessage(e) { e.preventDefault(); const message = typedMessage; setTypedMessage(""); await sendMessage(message); }

  async function lookupOrder(e) {
    e.preventDefault(); setLookupResult(null); setError("");
    try {
      const res = await fetch("/api/orders/lookup", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ order_id: lookupId }) });
      const data = await res.json();
      setLookupResult(res.ok ? data : { error: data.error || "Order not found" });
    } catch { setLookupResult({ error:"Backend is not running. Start the backend terminal first." }); }
  }

  const stateLabel = { idle:"Ready to connect", listening:"Listening", thinking:"Thinking", speaking:"Speaking" }[callState];
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Leaf size={20}/></span><span>AURA <small>SKINCARE</small></span></a>
      <div className="top-meta"><span className="online-dot"/> AI CUSTOMER CARE <span className="top-divider"/> DEMO ENVIRONMENT</div>
      <button className="help-button" onClick={() => window.open("https://www.aad.org/public/everyday-care/skin-care-basics", "_blank")}><span>Skin care guide</span><ArrowUpRight size={15}/></button>
    </header>

    <main>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> YOUR PERSONAL SKINCARE ASSISTANT</div>
        <h1>A little care.<br/><em>A lot of confidence.</em></h1>
        <p className="hero-copy">Meet Aria, your Aura support specialist. Ask about your order, our products, delivery, or returns — just speak naturally.</p>
      </section>

      <section className="workspace">
        <div className="main-column">
          <div className="call-card">
            <div className="card-topline"><span className="mini-label">VOICE SUPPORT</span><span className={`state-pill ${callState}`}><span className="state-dot"/>{stateLabel}</span></div>
            <div className={`aria-orb ${callState}`}><div className="orb-inner"><Headphones size={34}/></div><span className="orb-ring ring-one"/><span className="orb-ring ring-two"/></div>
            <h2>Hi, I'm Aria.</h2>
            <p className="call-subtitle">{callState === "idle" ? "I'm here to make things simple. What can I help you with today?" : callState === "listening" ? "I'm listening. Go ahead." : callState === "thinking" ? "One moment while I check that for you…" : "I'm speaking. You can interrupt me anytime."}</p>
            <div className="waveform" aria-label={stateLabel}>{Array.from({length:31}, (_,i)=><span key={i} style={{"--i":i}} className={callState === "speaking" || callState === "listening" ? "active" : ""}/>)}</div>
            <div className="call-actions">
              <button className="start-button" onClick={startCall} disabled={callState !== "idle"}><Phone size={17} fill="currentColor"/> Start call</button>
              <button className="end-button" onClick={endCall} disabled={callState === "idle"}><PhoneOff size={16}/> End call</button>
            </div>
            <form className="lookup-form" onSubmit={submitTypedMessage} style={{marginTop:"14px"}}><label htmlFor="chat-message">Or type a message to Aria</label><div className="lookup-row"><input id="chat-message" value={typedMessage} onChange={e=>setTypedMessage(e.target.value)} placeholder="Ask about ORD-101 or returns"/><button type="submit" aria-label="Send message" disabled={!typedMessage.trim()}><ArrowUpRight size={17}/></button></div></form>
            <div className="mic-note"><Mic size={13}/> Microphone permission is required for voice <span>·</span> Use headphones for best results</div>
            {error && <div className="error-banner"><CircleAlert size={16}/><span>{error}</span></div>}
          </div>

          <div className="panel transcript-panel">
            <div className="panel-heading"><div><span className="mini-label">LIVE CONVERSATION</span><h3>Call transcript</h3></div><span className="count-chip">{transcript.length} messages</span></div>
            <div className="transcript-body">
              {transcript.length === 0 ? <div className="empty-state"><div className="empty-icon"><Volume2 size={20}/></div><strong>Your conversation will appear here</strong><p>Start a call and talk to Aria. Your transcript will be collected as you speak.</p></div> :
                transcript.map((line,i)=><div className={`message ${line.role}`} key={i}><div className="message-avatar">{line.role === "aria" ? <Leaf size={14}/> : "Y"}</div><div className="message-content"><div className="message-meta"><strong>{line.role === "aria" ? "Aria" : "You"}</strong><time>{line.time}</time></div><p>{line.text}</p></div></div>)}
            </div>
          </div>

          {summary && <div className="panel summary-panel"><div className="panel-heading"><div><span className="mini-label">POST-CALL REPORT</span><h3>Call summary</h3></div><CheckCircle2 size={20} color="#4b7659"/></div><pre>{JSON.stringify(summary,null,2)}</pre><button className="copy-button" onClick={() => navigator.clipboard?.writeText(JSON.stringify({ transcript, summary },null,2))}>Copy transcript + JSON</button></div>}
        </div>

        <aside className="side-column">
          <div className="panel order-panel">
            <div className="panel-heading"><div><span className="mini-label">QUICK REFERENCE</span><h3>Test orders</h3></div><Package size={20}/></div>
            <p className="panel-intro">Try asking Aria about any of these sample orders during your call.</p>
            <div className="order-list">{orders.map(order=><div className="order-item" key={order.order_id}><div className="order-icon"><Package size={17}/></div><div className="order-info"><div className="order-id">{order.order_id}<span className={`status-tag ${order.status.toLowerCase().replaceAll(" ","-")}`}>{order.status}</span></div><strong>{order.product}</strong><span className="order-customer">{order.customer} · ₹{order.value}</span><small>{order.notes}</small></div></div>)}</div>
            <form className="lookup-form" onSubmit={lookupOrder}><label htmlFor="order-id">Look up an order</label><div className="lookup-row"><input id="order-id" value={lookupId} onChange={e=>setLookupId(e.target.value)} placeholder="e.g. ORD-101"/><button type="submit" aria-label="Search order"><ArrowUpRight size={17}/></button></div></form>
            {lookupResult && <div className={`lookup-result ${lookupResult.error ? "failed" : ""}`}>{lookupResult.error ? lookupResult.error : <><strong>{lookupResult.order_id} · {lookupResult.status}</strong><span>{lookupResult.product}</span><span>{lookupResult.carrier ? `${lookupResult.carrier} · ${lookupResult.tracking_id}` : lookupResult.notes}</span></>}</div>}
          </div>

          <div className="panel policy-panel"><div className="panel-heading"><div><span className="mini-label">THE ESSENTIALS</span><h3>Our policies</h3></div><Leaf size={20}/></div>
            <div className="policy-row"><div className="policy-icon"><Truck size={17}/></div><div><strong>Delivery</strong><p>3–5 business days. Free over ₹499; otherwise ₹50.</p></div></div>
            <div className="policy-row"><div className="policy-icon"><CheckCircle2 size={17}/></div><div><strong>Returns</strong><p>Within 7 days for unopened, unused products in original packaging.</p></div></div>
            <div className="policy-row"><div className="policy-icon"><Package size={17}/></div><div><strong>Damaged items</strong><p>Report within 48 hours with photos for replacement.</p></div></div>
            <div className="policy-row"><div className="policy-icon"><Phone size={17}/></div><div><strong>Cancellation</strong><p>Only while the order is Processing.</p></div></div>
          </div>
          <div className="tip-card"><Sparkles size={17}/><div><strong>Try asking Aria</strong><p>“Where is ORD-101?” · “Can I return ORD-102?” · “Can I cancel ORD-103?”</p></div></div>
        </aside>
      </section>
    </main>
    <footer><div className="footer-brand"><Leaf size={15}/> AURA SKINCARE</div><span>Thoughtful care, every conversation.</span><span className="footer-demo">Assessment demo · Mock order data</span></footer>
  </div>;
}
