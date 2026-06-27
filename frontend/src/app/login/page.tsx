"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { APIClient } from "../../lib/api-client";
import { Shield, Sparkles, TrendingUp, Cpu, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if already logged in
  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      router.push("/");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        // Register API Call
        await APIClient.request("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            first_name: firstName || null,
            last_name: lastName || null,
          }),
        });

        // Toggle to login and show success
        setIsRegistering(false);
        setPassword("");
        setError("Account created successfully! Please log in.");
      } else {
        // Login API Call
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        const response: any = await APIClient.request("/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        APIClient.setTokens(response.access_token, response.refresh_token);
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background relative overflow-hidden items-center justify-center p-4">
      {/* Background glowing decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Main glassmorphic login container */}
      <div className="w-full max-w-md bg-card border border-border p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10 backdrop-blur-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 border border-primary/30 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
            <Cpu className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ANTIGRAVITY TRADING
          </h1>
          <p className="text-muted text-sm mt-2">
            AI-Powered Trading Research Platform
          </p>
        </div>

        {error && (
          <div
            className={`p-3 rounded-lg mb-6 text-sm border ${
              error.includes("successfully")
                ? "bg-success/10 border-success/30 text-success"
                : "bg-danger/10 border-danger/30 text-danger"
            }`}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegistering && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
                  placeholder="Doe"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-accent-hover text-white rounded-lg py-3 font-semibold text-sm transition-all shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_25px_rgba(139,92,246,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                {isRegistering ? "Create Free Account" : "Access Platform"}
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-muted border-t border-border/50 pt-5">
          {isRegistering ? (
            <p>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setIsRegistering(false);
                  setError(null);
                }}
                className="text-primary hover:underline font-semibold"
              >
                Sign In Instead
              </button>
            </p>
          ) : (
            <p>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  setIsRegistering(true);
                  setError(null);
                }}
                className="text-accent hover:underline font-semibold"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
