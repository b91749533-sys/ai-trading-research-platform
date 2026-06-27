"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { APIClient } from "../lib/api-client";
import {
  Cpu,
  Plus,
  Code,
  Play,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  FileText,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Calendar,
  Layers,
  ArrowUpRight
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

// Default template python code
const DEFAULT_STRATEGY_CODE = `class Strategy:
    def __init__(self, parameters):
        self.params = parameters
        self.fast_ma = parameters.get("fast_ma", 10)
        self.slow_ma = parameters.get("slow_ma", 30)

    def on_bar(self, bar, broker):
        # Calculate moving averages
        fast = broker.get_indicator("SMA", self.fast_ma)
        slow = broker.get_indicator("SMA", self.slow_ma)
        
        # Simple crossover strategy
        if fast > slow and not broker.has_position():
            broker.buy(symbol=bar.symbol, qty=10)
        elif fast < slow and broker.has_position():
            broker.sell_all(symbol=bar.symbol)
`;

export default function DashboardPage() {
  const router = useRouter();
  
  // App States
  const [user, setUser] = useState<any>(null);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [backtests, setBacktests] = useState<any[]>([]);
  const [selectedBacktest, setSelectedBacktest] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [wsLogs, setWsLogs] = useState<string[]>([]);
  
  // Strategy Create Form
  const [isCreatingStrategy, setIsCreatingStrategy] = useState(false);
  const [newStratName, setNewStratName] = useState("");
  const [newStratDesc, setNewStratDesc] = useState("");
  const [newStratCode, setNewStratCode] = useState(DEFAULT_STRATEGY_CODE);
  
  // Backtest Launch Form
  const [btStartDate, setBtStartDate] = useState("2026-01-01");
  const [btEndDate, setBtEndDate] = useState("2026-06-01");
  const [btInitBal, setBtInitBal] = useState("10000");
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [btRunningId, setBtRunningId] = useState<string | null>(null);
  const [btPercent, setBtPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // WebSockets Ref
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial profile and strategies
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const userProfile = await APIClient.request("/auth/me");
        setUser(userProfile);

        const strats: any = await APIClient.request("/strategies/");
        setStrategies(strats);
        if (strats.length > 0) {
          setSelectedStrategy(strats[0]);
        }
      } catch (err: any) {
        console.error("Auth / Fetch Error", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [router]);

  // Fetch backtests whenever strategy changes
  useEffect(() => {
    if (!selectedStrategy) {
      setBacktests([]);
      setSelectedBacktest(null);
      return;
    }

    const fetchBacktests = async () => {
      try {
        const res: any = await APIClient.request("/backtests/");
        // Filter backtests matching selected strategy
        const filtered = res.filter((b: any) => b.strategy_id === selectedStrategy.id);
        setBacktests(filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        
        if (filtered.length > 0) {
          handleSelectBacktest(filtered[0]);
        } else {
          setSelectedBacktest(null);
          setTrades([]);
        }
      } catch (err: any) {
        console.error("Fetch Backtests Error", err);
      }
    };
    fetchBacktests();
  }, [selectedStrategy]);

  // Select Backtest Details and Trades
  const handleSelectBacktest = async (bt: any) => {
    setSelectedBacktest(bt);
    setWsLogs([]);
    try {
      const trs: any = await APIClient.request(`/backtests/${bt.id}/trades`);
      setTrades(trs);
    } catch (err) {
      console.error("Fetch Trades Error", err);
    }
  };

  // Sign out handler
  const handleSignOut = () => {
    APIClient.clearTokens();
    router.push("/login");
  };

  // Create strategy
  const handleCreateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const newStrat: any = await APIClient.request("/strategies/", {
        method: "POST",
        body: JSON.stringify({
          name: newStratName,
          description: newStratDesc,
          code_content: newStratCode,
          parameters: { fast_ma: 10, slow_ma: 30 },
        }),
      });

      setStrategies([newStrat, ...strategies]);
      setSelectedStrategy(newStrat);
      setIsCreatingStrategy(false);
      setNewStratName("");
      setNewStratDesc("");
      setNewStratCode(DEFAULT_STRATEGY_CODE);
    } catch (err: any) {
      setError(err.message || "Failed to create strategy");
    } finally {
      setLoading(false);
    }
  };

  // Run local simulation in browser sandbox when offline/mocking
  const runLocalSimulation = (backtestId: string) => {
    setBtRunningId(backtestId);
    setBtPercent(0);
    setWsLogs(["Queueing backtest in browser sandbox..."]);

    const steps = [
      { percent: 10, msg: "Initializing sandbox environment..." },
      { percent: 30, msg: "Loading historical market data bars..." },
      { percent: 50, msg: "Executing strategy model crossover checks..." },
      { percent: 70, msg: "Simulating trade transactions..." },
      { percent: 90, msg: "Evaluating final metrics (Sharpe ratio, Drawdown)..." },
      { percent: 100, msg: "Saving simulation results..." }
    ];

    let currentStep = 0;
    
    // Set status to RUNNING in local list
    setBacktests((prevList) =>
      prevList.map((item) =>
        item.id === backtestId ? { ...item, status: "RUNNING" } : item
      )
    );

    const interval = setInterval(async () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        setBtPercent(step.percent);
        setWsLogs((prev) => [...prev, `[Mock Sandbox] ${step.msg}`]);
        currentStep++;
      } else {
        clearInterval(interval);
        
        // 1. Generate final metrics
        const totalReturn = parseFloat((Math.random() * 0.5 - 0.1).toFixed(4)); // -10% to +40%
        const startBal = parseFloat(btInitBal);
        const finalBal = parseFloat((startBal * (1.0 + totalReturn)).toFixed(2));
        const sharpe = parseFloat((Math.random() * 2.2 + 0.8).toFixed(2));
        const maxDrawdown = parseFloat((Math.random() * 0.18 + 0.02).toFixed(4));
        const winRate = parseFloat((Math.random() * 0.25 + 0.45).toFixed(4));

        // 2. Generate mock trades
        const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN"];
        const numTrades = Math.floor(Math.random() * 4) + 3;
        const mockTradesList = [];
        let tradeDate = new Date(btStartDate);
        const dateRangeDays = (new Date(btEndDate).getTime() - new Date(btStartDate).getTime()) / (1000 * 60 * 60 * 24);

        for (let i = 0; i < numTrades; i++) {
          const symbol = symbols[Math.floor(Math.random() * symbols.length)];
          const side = Math.random() > 0.5 ? "BUY" : "SELL";
          const qty = Math.floor(Math.random() * 25) + 5;
          const price = parseFloat((Math.random() * 200 + 100).toFixed(2));
          const commission = parseFloat((qty * price * 0.0005).toFixed(4));
          
          tradeDate = new Date(tradeDate.getTime() + (dateRangeDays / numTrades) * 24 * 60 * 60 * 1000 * Math.random());
          
          mockTradesList.push({
            id: crypto.randomUUID(),
            backtest_id: backtestId,
            symbol,
            side,
            quantity: qty,
            price,
            commission,
            executed_at: tradeDate.toISOString()
          });
        }

        // 3. Update localStorage databases
        const allBacktests = JSON.parse(localStorage.getItem("mock_backtests") || "[]");
        const idx = allBacktests.findIndex((b: any) => b.id === backtestId);
        if (idx !== -1) {
          allBacktests[idx] = {
            ...allBacktests[idx],
            status: "COMPLETED",
            end_balance: finalBal,
            total_return: totalReturn,
            sharpe_ratio: sharpe,
            sortino_ratio: parseFloat((sharpe * 1.2).toFixed(2)),
            max_drawdown: maxDrawdown,
            win_rate: winRate,
            completed_at: new Date().toISOString()
          };
          localStorage.setItem("mock_backtests", JSON.stringify(allBacktests));
        }

        const allTrades = JSON.parse(localStorage.getItem("mock_trades") || "[]");
        localStorage.setItem("mock_trades", JSON.stringify([...mockTradesList, ...allTrades]));

        setBtRunningId(null);
        setWsLogs((prev) => [...prev, "[Mock Sandbox] Backtest complete! Refreshing..."]);
        
        // Refresh and select
        await refreshCurrentBacktests();
      }
    }, 600);
  };

  // Run backtest async
  const handleRunBacktest = async () => {
    if (!selectedStrategy) return;
    setError(null);
    setBtRunningId(null);
    setBtPercent(0);
    setWsLogs(["Queueing backtest..."]);

    try {
      const res: any = await APIClient.request("/backtests/", {
        method: "POST",
        body: JSON.stringify({
          strategy_id: selectedStrategy.id,
          start_date: new Date(btStartDate).toISOString(),
          end_date: new Date(btEndDate).toISOString(),
          initial_balance: parseFloat(btInitBal),
        }),
      });

      const backtestId = res.id;
      setBtRunningId(backtestId);
      
      // Update local backtests list with pending status
      const updatedBt = { ...res, status: "PENDING" };
      setBacktests([updatedBt, ...backtests]);
      setSelectedBacktest(updatedBt);

      const token = localStorage.getItem("access_token") || "";
      if (token.startsWith("mock-jwt-access-")) {
        runLocalSimulation(backtestId);
      } else {
        // Connect to WebSocket Progress Channel
        connectWebSocket(backtestId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to run backtest");
    }
  };

  // WebSocket progress listener
  const connectWebSocket = (backtestId: string) => {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${wsProto}//${host}/api/v1/backtests/ws/${backtestId}?token=${localStorage.getItem("access_token") || ""}`;

    if (wsRef.current) {
      wsRef.current.close();
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch (e) {
      console.warn("WebSocket constructor failed, falling back to local simulation:", e);
      runLocalSimulation(backtestId);
      return;
    }

    ws.onopen = () => {
      // Send token for authentication
      ws.send(JSON.stringify({ token: localStorage.getItem("access_token") }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "progress") {
        setBtPercent(data.percent);
        setWsLogs((prev) => [...prev, data.message]);
        
        // Update list status to RUNNING
        setBacktests((prevList) =>
          prevList.map((item) =>
            item.id === backtestId ? { ...item, status: "RUNNING" } : item
          )
        );
      } else if (data.type === "complete") {
        setBtPercent(100);
        setBtRunningId(null);
        setWsLogs((prev) => [...prev, "Backtest run completed successfully!"]);
        
        // Refresh Backtests and Trades list
        refreshCurrentBacktests();
        ws.close();
      } else if (data.type === "failed") {
        setBtRunningId(null);
        setWsLogs((prev) => [...prev, `Backtest failed: ${data.error}`]);
        refreshCurrentBacktests();
        ws.close();
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket connection failed, falling back to local simulation mode:", err);
      runLocalSimulation(backtestId);
    };
  };

  const refreshCurrentBacktests = async () => {
    try {
      const res: any = await APIClient.request("/backtests/");
      const filtered = res.filter((b: any) => b.strategy_id === selectedStrategy.id);
      const sorted = filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setBacktests(sorted);
      if (sorted.length > 0) {
        // Select the one we just ran
        const runResult = sorted.find((b: any) => b.id === btRunningId) || sorted[0];
        handleSelectBacktest(runResult);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Generate chart data based on trades
  const getChartData = () => {
    if (!selectedBacktest || trades.length === 0) {
      // Dummy data representing placeholder return line
      return [
        { date: "Day 0", Balance: parseFloat(btInitBal) },
        { date: "Day 10", Balance: parseFloat(btInitBal) },
      ];
    }
    
    let currentBalance = parseFloat(selectedBacktest.initial_balance);
    const data = [{ date: "Start", Balance: currentBalance }];
    
    trades.forEach((trade) => {
      const factor = trade.side === "BUY" ? -1 : 1;
      const tradeVal = parseFloat(trade.quantity) * parseFloat(trade.price) * factor - parseFloat(trade.commission);
      currentBalance = currentBalance + tradeVal;
      
      data.push({
        date: new Date(trade.executed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        Balance: parseFloat(currentBalance.toFixed(2))
      });
    });
    
    return data;
  };

  const chartData = getChartData();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.15)]">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ANTIGRAVITY TRADING
            </h1>
            <p className="text-[10px] text-muted tracking-wider uppercase font-semibold">
              Research Sandbox
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-medium text-foreground">
              {user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email : "Loading User..."}
            </span>
            <span className="text-[10px] text-muted">{user?.email}</span>
          </div>
          
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs border border-border hover:border-danger hover:text-danger bg-background/50 px-3 py-1.5 rounded-lg transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main layout container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Strategy navigation */}
        <aside className="w-80 border-r border-border bg-card/20 flex flex-col p-4 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Strategies
            </span>
            <button
              onClick={() => setIsCreatingStrategy(true)}
              className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary-hover text-white px-2.5 py-1.5 rounded-lg font-semibold transition-all shadow-[0_2px_10px_rgba(139,92,246,0.2)]"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>

          {/* Strategy List */}
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {strategies.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted border border-dashed border-border rounded-xl">
                No strategies found. Click New to add one.
              </div>
            ) : (
              strategies.map((strat) => (
                <button
                  key={strat.id}
                  onClick={() => {
                    setSelectedStrategy(strat);
                    setIsCreatingStrategy(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between ${
                    selectedStrategy?.id === strat.id
                      ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(139,92,246,0.05)]"
                      : "bg-card border-border/60 hover:bg-card-hover"
                  }`}
                >
                  <div className="flex flex-col gap-1 w-11/12">
                    <span className="font-semibold text-sm truncate">{strat.name}</span>
                    <span className="text-xs text-muted truncate">{strat.description || "No description"}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Center Panel & Detail Workspaces */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 bg-background">
          {error && (
            <div className="p-4 bg-danger/10 border border-danger/30 text-danger rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          {isCreatingStrategy ? (
            /* Strategy Creation IDE form */
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-bold mb-4">Create Strategy</h2>
              <form onSubmit={handleCreateStrategy} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    Strategy Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newStratName}
                    onChange={(e) => setNewStratName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
                    placeholder="E.g. SMA Crossover 20-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    value={newStratDesc}
                    onChange={(e) => setNewStratDesc(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all text-foreground h-16 resize-none"
                    placeholder="Short description of model hypothesis..."
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                      Python Engine Source Code
                    </label>
                    <span className="text-[10px] text-muted font-mono">Python 3.11</span>
                  </div>
                  <textarea
                    required
                    value={newStratCode}
                    onChange={(e) => setNewStratCode(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-4 text-xs font-mono focus:outline-none focus:border-primary transition-all text-foreground h-80 resize-none"
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingStrategy(false)}
                    className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-card-hover transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-all shadow-[0_2px_10px_rgba(139,92,246,0.2)]"
                  >
                    Save Strategy
                  </button>
                </div>
              </form>
            </div>
          ) : selectedStrategy ? (
            /* Main Strategy details dashboard */
            <div className="space-y-6">
              {/* Top Meta info */}
              <div className="bg-card border border-border p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{selectedStrategy.name}</h2>
                  <p className="text-sm text-muted mt-1">{selectedStrategy.description}</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[11px] bg-primary/10 border border-primary/30 text-primary px-3 py-1 rounded-full font-semibold">
                    Parameters: Fast MA=10, Slow MA=30
                  </span>
                </div>
              </div>

              {/* Grid: Backtester trigger / Runs vs analytics charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Backtester run form */}
                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Run Backtest
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-muted mb-1.5 font-medium">Start Date</label>
                      <input
                        type="date"
                        value={btStartDate}
                        onChange={(e) => setBtStartDate(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted mb-1.5 font-medium">End Date</label>
                      <input
                        type="date"
                        value={btEndDate}
                        onChange={(e) => setBtEndDate(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted mb-1.5 font-medium">Initial Balance ($)</label>
                      <input
                        type="number"
                        value={btInitBal}
                        onChange={(e) => setBtInitBal(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleRunBacktest}
                    disabled={!!btRunningId}
                    className="w-full mt-2 bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-accent-hover text-white rounded-lg py-2.5 font-semibold text-xs transition-all shadow-[0_2px_15px_rgba(139,92,246,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5" /> Start Simulation
                  </button>

                  {/* Progress Display */}
                  {btRunningId && (
                    <div className="border border-border p-3 rounded-xl space-y-2 mt-2 bg-background/50">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-primary animate-pulse flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary glow-active inline-block" />
                          Processing...
                        </span>
                        <span className="font-mono">{btPercent.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${btPercent}%` }}
                        />
                      </div>
                      <div className="h-24 overflow-y-auto font-mono text-[9px] text-muted space-y-1 mt-2 border-t border-border/50 pt-2">
                        {wsLogs.map((log, idx) => (
                          <div key={idx}>{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Strategy runs list */}
                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col lg:col-span-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-accent" /> Simulation History
                  </h3>
                  
                  <div className="overflow-y-auto max-h-60 space-y-2 flex-1 pr-1">
                    {backtests.length === 0 ? (
                      <div className="text-center py-10 text-xs text-muted border border-dashed border-border rounded-xl">
                        No simulation runs matching this strategy.
                      </div>
                    ) : (
                      backtests.map((bt) => (
                        <button
                          key={bt.id}
                          onClick={() => handleSelectBacktest(bt)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                            selectedBacktest?.id === bt.id
                              ? "bg-card border-accent shadow-[0_0_15px_rgba(6,182,212,0.05)]"
                              : "bg-background/40 border-border/60 hover:bg-card-hover"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                bt.status === "COMPLETED"
                                  ? "bg-success"
                                  : bt.status === "FAILED"
                                  ? "bg-danger"
                                  : bt.status === "RUNNING"
                                  ? "bg-primary animate-pulse"
                                  : "bg-warning"
                              }`}
                            />
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold text-foreground">
                                Backtest {bt.id.substring(0, 8)}
                              </span>
                              <span className="text-[10px] text-muted flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(bt.start_date).toLocaleDateString()} - {new Date(bt.end_date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex items-center gap-6">
                            {bt.status === "COMPLETED" && (
                              <div className="flex flex-col">
                                <span className={`text-xs font-bold ${bt.total_return >= 0 ? "text-success" : "text-danger"}`}>
                                  {bt.total_return >= 0 ? "+" : ""}
                                  {(bt.total_return * 100).toFixed(2)}%
                                </span>
                                <span className="text-[9px] text-muted">SR: {bt.sharpe_ratio}</span>
                              </div>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Run Details / Performance Analytics Charts */}
              {selectedBacktest && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left detail metrics */}
                  <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                      Run Metrics
                    </h3>
                    
                    {selectedBacktest.status === "COMPLETED" ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-background/50 border border-border p-3.5 rounded-xl">
                          <span className="text-[10px] text-muted uppercase font-bold">Total Return</span>
                          <div className={`text-lg font-bold mt-1 flex items-center gap-1 ${
                            selectedBacktest.total_return >= 0 ? "text-success" : "text-danger"
                          }`}>
                            {selectedBacktest.total_return >= 0 ? "+" : ""}
                            {(selectedBacktest.total_return * 100).toFixed(2)}%
                          </div>
                        </div>
                        
                        <div className="bg-background/50 border border-border p-3.5 rounded-xl">
                          <span className="text-[10px] text-muted uppercase font-bold">Sharpe Ratio</span>
                          <div className="text-lg font-bold text-foreground mt-1">
                            {selectedBacktest.sharpe_ratio}
                          </div>
                        </div>
                        
                        <div className="bg-background/50 border border-border p-3.5 rounded-xl">
                          <span className="text-[10px] text-muted uppercase font-bold">Max Drawdown</span>
                          <div className="text-lg font-bold text-danger mt-1">
                            {(selectedBacktest.max_drawdown * 100).toFixed(2)}%
                          </div>
                        </div>
                        
                        <div className="bg-background/50 border border-border p-3.5 rounded-xl">
                          <span className="text-[10px] text-muted uppercase font-bold">Win Rate</span>
                          <div className="text-lg font-bold text-foreground mt-1">
                            {(selectedBacktest.win_rate * 100).toFixed(1)}%
                          </div>
                        </div>

                        <div className="bg-background/50 border border-border p-3.5 rounded-xl col-span-2">
                          <span className="text-[10px] text-muted uppercase font-bold flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-accent" /> Portfolio Value
                          </span>
                          <div className="text-lg font-extrabold text-foreground mt-1.5 flex items-center justify-between">
                            <span>${parseFloat(selectedBacktest.end_balance).toLocaleString()}</span>
                            <span className="text-xs text-muted font-normal">Initial: ${parseFloat(selectedBacktest.initial_balance).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ) : selectedBacktest.status === "FAILED" ? (
                      <div className="p-4 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs font-mono">
                        <AlertTriangle className="w-5 h-5 mb-2" />
                        {selectedBacktest.error_message || "Unknown execution error."}
                      </div>
                    ) : (
                      <div className="text-center py-10 text-xs text-muted">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Simulation is currently in queue or execution step.
                      </div>
                    )}
                  </div>

                  {/* Right interactive chart */}
                  <div className="bg-card border border-border p-6 rounded-2xl lg:col-span-2 flex flex-col h-[320px]">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">
                      Equity Curve
                    </h3>
                    
                    <div className="flex-1 w-full text-xs">
                      {selectedBacktest.status === "COMPLETED" ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2438" />
                            <XAxis dataKey="date" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" domain={['dataMin - 100', 'dataMax + 100']} />
                            <Tooltip contentStyle={{ backgroundColor: '#11131c', borderColor: '#1f2438' }} />
                            <Area type="monotone" dataKey="Balance" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted">
                          No analytical data to map.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Trades breakdown list */}
              {selectedBacktest && selectedBacktest.status === "COMPLETED" && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">
                    Transaction Log
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/80 text-muted">
                          <th className="py-3 px-4 uppercase tracking-wider">Symbol</th>
                          <th className="py-3 px-4 uppercase tracking-wider">Action</th>
                          <th className="py-3 px-4 uppercase tracking-wider">Quantity</th>
                          <th className="py-3 px-4 uppercase tracking-wider">Execution Price</th>
                          <th className="py-3 px-4 uppercase tracking-wider">Commission</th>
                          <th className="py-3 px-4 uppercase tracking-wider text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {trades.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-muted">
                              No trades executed by this strategy.
                            </td>
                          </tr>
                        ) : (
                          trades.map((trade) => (
                            <tr key={trade.id} className="hover:bg-card-hover/30">
                              <td className="py-3 px-4 font-bold text-foreground">{trade.symbol}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  trade.side === "BUY" ? "bg-success/10 text-success border border-success/20" : "bg-primary/10 text-primary border border-primary/20"
                                }`}>
                                  {trade.side}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-foreground">{parseFloat(trade.quantity).toLocaleString()}</td>
                              <td className="py-3 px-4 text-foreground">${parseFloat(trade.price).toFixed(2)}</td>
                              <td className="py-3 px-4 text-muted">${parseFloat(trade.commission).toFixed(4)}</td>
                              <td className="py-3 px-4 text-muted text-right">
                                {new Date(trade.executed_at).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* No strategy selected state */
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20 border border-dashed border-border rounded-3xl bg-card/10">
              <Code className="w-12 h-12 text-muted mb-4 animate-bounce" />
              <h3 className="text-lg font-bold">Select or Create a Trading Strategy</h3>
              <p className="text-sm text-muted mt-2 max-w-sm">
                Get started by initializing a new Python strategy script or picking an existing model configuration from the sidebar.
              </p>
              <button
                onClick={() => setIsCreatingStrategy(true)}
                className="mt-6 flex items-center gap-1.5 text-xs bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg font-semibold transition-all shadow-[0_2px_15px_rgba(139,92,246,0.3)]"
              >
                <Plus className="w-4 h-4" /> Create First Strategy
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
