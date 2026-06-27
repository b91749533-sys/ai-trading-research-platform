const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost/api/v1";

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

// Client-side LocalStorage database mock for offline fallback
class MockDB {
  private static get(key: string): any[] {
    if (typeof window === "undefined") return [];
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  }

  private static set(key: string, data: any[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(data));
  }

  public static handleRequest(path: string, options: RequestOptions = {}): any {
    const method = options.method || "GET";
    const cleanPath = path.split("?")[0];
    
    // Auth: Register
    if (cleanPath === "/auth/register" && method === "POST") {
      const body = JSON.parse(options.body as string);
      const users = this.get("mock_users");
      if (users.find(u => u.email === body.email)) {
        throw new Error("The user with this email already exists in the system.");
      }
      const newUser = {
        id: crypto.randomUUID(),
        email: body.email,
        password: body.password, // plain for mock simple auth check
        first_name: body.first_name || "",
        last_name: body.last_name || "",
        is_active: true,
        is_superuser: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      users.push(newUser);
      this.set("mock_users", users);
      return { id: newUser.id, email: newUser.email, first_name: newUser.first_name, last_name: newUser.last_name, is_active: true, is_superuser: false, created_at: newUser.created_at, updated_at: newUser.updated_at };
    }

    // Auth: Login
    if (cleanPath === "/auth/login" && method === "POST") {
      // In OAuth2PasswordRequestForm, body is URLSearchParams
      const params = new URLSearchParams(options.body as string);
      const username = params.get("username");
      const password = params.get("password");
      
      const users = this.get("mock_users");
      const user = users.find(u => u.email === username && u.password === password);
      
      if (!user) {
        throw new Error("Incorrect email or password");
      }
      
      return {
        access_token: `mock-jwt-access-${user.id}`,
        refresh_token: `mock-jwt-refresh-${user.id}`,
        token_type: "bearer"
      };
    }

    // Auth: Refresh
    if (cleanPath === "/auth/refresh" && method === "POST") {
      const url = new URL(path, "http://dummy.com");
      const refToken = url.searchParams.get("refresh_token") || "";
      if (!refToken.startsWith("mock-jwt-refresh-")) {
        throw new Error("Invalid refresh token");
      }
      const userId = refToken.replace("mock-jwt-refresh-", "");
      return {
        access_token: `mock-jwt-access-${userId}`,
        refresh_token: `mock-jwt-refresh-${userId}`,
        token_type: "bearer"
      };
    }

    // Auth: Me
    if (cleanPath === "/auth/me" && method === "GET") {
      const authHeader = (options.headers as any)?.Authorization || "";
      const token = authHeader.replace("Bearer mock-jwt-access-", "");
      const users = this.get("mock_users");
      const user = users.find(u => u.id === token);
      if (!user) {
        // Fallback user if first time
        return {
          id: "00000000-0000-0000-0000-000000000000",
          email: "guest@antigravity.io",
          first_name: "Guest",
          last_name: "Developer",
          is_active: true,
          is_superuser: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      return { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, is_active: true, is_superuser: user.is_superuser, created_at: user.created_at, updated_at: user.updated_at };
    }

    // Strategies: List / Create
    if (cleanPath === "/strategies/" || cleanPath === "/strategies") {
      if (method === "GET") {
        return this.get("mock_strategies");
      }
      if (method === "POST") {
        const body = JSON.parse(options.body as string);
        const strats = this.get("mock_strategies");
        const newStrat = {
          id: crypto.randomUUID(),
          user_id: "00000000-0000-0000-0000-000000000000",
          name: body.name,
          description: body.description || "",
          code_content: body.code_content,
          parameters: body.parameters || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        strats.unshift(newStrat);
        this.set("mock_strategies", strats);
        return newStrat;
      }
    }

    // Strategies: Detail / Update / Delete
    if (cleanPath.startsWith("/strategies/")) {
      const parts = cleanPath.split("/");
      const id = parts[parts.length - 1] || parts[parts.length - 2];
      const strats = this.get("mock_strategies");
      
      if (method === "GET") {
        const strat = strats.find(s => s.id === id);
        if (!strat) throw new Error("Strategy not found");
        return strat;
      }
      if (method === "PUT") {
        const body = JSON.parse(options.body as string);
        const idx = strats.findIndex(s => s.id === id);
        if (idx === -1) throw new Error("Strategy not found");
        strats[idx] = { ...strats[idx], ...body, updated_at: new Date().toISOString() };
        this.set("mock_strategies", strats);
        return strats[idx];
      }
      if (method === "DELETE") {
        const filtered = strats.filter(s => s.id !== id);
        this.set("mock_strategies", filtered);
        return {};
      }
    }

    // Backtests: List / Create
    if (cleanPath === "/backtests/" || cleanPath === "/backtests") {
      if (method === "GET") {
        return this.get("mock_backtests");
      }
      if (method === "POST") {
        const body = JSON.parse(options.body as string);
        const backtests = this.get("mock_backtests");
        const newBt = {
          id: crypto.randomUUID(),
          strategy_id: body.strategy_id,
          status: "PENDING",
          start_date: body.start_date,
          end_date: body.end_date,
          initial_balance: body.initial_balance,
          end_balance: null,
          total_return: null,
          sharpe_ratio: null,
          sortino_ratio: null,
          max_drawdown: null,
          win_rate: null,
          error_message: null,
          created_at: new Date().toISOString(),
          completed_at: null
        };
        backtests.unshift(newBt);
        this.set("mock_backtests", backtests);
        return newBt;
      }
    }

    // Backtests: Details
    if (cleanPath.startsWith("/backtests/") && cleanPath.endsWith("/trades")) {
      const parts = cleanPath.split("/");
      const btId = parts[parts.length - 2];
      const trades = this.get("mock_trades");
      return trades.filter(t => t.backtest_id === btId);
    }

    if (cleanPath.startsWith("/backtests/")) {
      const parts = cleanPath.split("/");
      const id = parts[parts.length - 1] || parts[parts.length - 2];
      const backtests = this.get("mock_backtests");
      const bt = backtests.find(b => b.id === id);
      if (!bt) throw new Error("Backtest not found");
      return bt;
    }

    throw new Error(`Endpoint mock path not matching: ${method} ${cleanPath}`);
  }
}

export class APIClient {
  private static getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private static getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refresh_token");
  }

  public static setTokens(access: string, refresh: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }

  public static clearTokens() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  private static async refresh(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    // Direct mock check to speed up offline demo
    if (refreshToken.startsWith("mock-jwt-refresh-")) {
      try {
        const response = MockDB.handleRequest(`/auth/refresh?refresh_token=${refreshToken}`, { method: "POST" });
        this.setTokens(response.access_token, response.refresh_token);
        return true;
      } catch {
        return false;
      }
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  public static async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${API_URL}${path}`);
    if (options.params) {
      Object.keys(options.params).forEach((key) =>
        url.searchParams.append(key, options.params![key])
      );
    }

    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const token = this.getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    // If client token is a mock token, bypass server check immediately to prevent delays
    if (token?.startsWith("mock-jwt-access-")) {
      console.log(`[Mock API Proxy] Intercepting request: ${options.method || "GET"} ${path}`);
      return new Promise((resolve, reject) => {
        try {
          const res = MockDB.handleRequest(path, options);
          resolve(res as T);
        } catch (err: any) {
          reject(err);
        }
      });
    }

    try {
      let response = await fetch(url.toString(), config);

      if (response.status === 401) {
        const refreshed = await this.refresh();
        if (refreshed) {
          const newToken = this.getAccessToken();
          if (newToken) {
            headers.set("Authorization", `Bearer ${newToken}`);
          }
          response = await fetch(url.toString(), config);
        } else {
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          throw new Error("Session expired. Please log in again.");
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "An error occurred";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return response.json() as Promise<T>;
    } catch (err: any) {
      // Bypasses network failures (e.g. backend offline) by falling back to LocalStorage mock DB
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        console.warn(`[APIClient Fallback] Backend server unreachable. Bypassing request to client-side LocalStorage DB for offline mode: ${path}`);
        return new Promise((resolve, reject) => {
          try {
            const res = MockDB.handleRequest(path, options);
            resolve(res as T);
          } catch (mockErr: any) {
            reject(mockErr);
          }
        });
      }
      throw err;
    }
  }
}
