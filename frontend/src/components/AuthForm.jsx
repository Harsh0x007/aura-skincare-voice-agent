
import { useState } from "react";
import "./AuthForm.css";
import API_BASE_URL from "../api";

export default function AuthForm({ onLogin }) {
    const [mode, setMode] = useState("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const endpoint =
                mode === "login" ? "login" : "register";

            const response = await fetch(
                `${API_BASE_URL}/api/auth/${endpoint}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Authentication failed.");
            }

            localStorage.setItem("aura_token", data.token);
            onLogin(data.user);
        } catch (err) {
            setError(err.message || "Cannot connect to the backend.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h1>Aura Skincare</h1>
                <p>Your skincare journey starts here.</p>
                <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>

                {mode === "register" && (
                    <input
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        required
                    />
                )}

                <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                />

                <input
                    type="password"
                    placeholder="Password (at least 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={8}
                    required
                />

                {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}

                <button type="submit" disabled={loading}>
                    {loading
                        ? "Please wait..."
                        : mode === "login"
                            ? "Login"
                            : "Register"}
                </button>

                <p>
                    {mode === "login"
                        ? "New to Aura?"
                        : "Already have an account?"}{" "}
                    <button
                        type="button"
                        onClick={() => {
                            setMode(mode === "login" ? "register" : "login");
                            setError("");
                        }}
                    >
                        {mode === "login" ? "Create account" : "Login"}
                    </button>
                </p>
            </form>
        </main>
    );
}
