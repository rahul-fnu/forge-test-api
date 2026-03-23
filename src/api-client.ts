import { Todo, PaginatedResponse, RateLimitInfo } from "./types.js";

interface ListTodosOptions {
  page?: number;
  pageSize?: number;
  overdue?: boolean;
}

export class TodoApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<{ data: T; rateLimit: RateLimitInfo }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...(init?.headers as Record<string, string> ?? {}),
    };

    let res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    if (res.status === 429) {
      const resetAt = Number(res.headers.get("X-RateLimit-Reset") ?? "0");
      const waitMs = Math.max(0, resetAt * 1000 - Date.now());
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    }

    const rateLimit: RateLimitInfo = {
      limit: Number(res.headers.get("X-RateLimit-Limit") ?? "0"),
      remaining: Number(res.headers.get("X-RateLimit-Remaining") ?? "0"),
      resetAt: Number(res.headers.get("X-RateLimit-Reset") ?? "0"),
    };

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API error ${res.status}: ${body}`);
    }

    const data = res.status === 204 ? (undefined as T) : ((await res.json()) as T);
    return { data, rateLimit };
  }

  async listTodos(opts?: ListTodosOptions): Promise<{ data: PaginatedResponse<Todo>; rateLimit: RateLimitInfo }> {
    const params = new URLSearchParams();
    if (opts?.page !== undefined) params.set("page", String(opts.page));
    if (opts?.pageSize !== undefined) params.set("pageSize", String(opts.pageSize));
    if (opts?.overdue) params.set("overdue", "true");
    const qs = params.toString();
    return this.request<PaginatedResponse<Todo>>(`/todos${qs ? `?${qs}` : ""}`);
  }

  async createTodo(title: string): Promise<{ data: Todo; rateLimit: RateLimitInfo }> {
    return this.request<Todo>("/todos", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }

  async updateTodo(id: string, updates: Partial<Pick<Todo, "title" | "completed" | "dueDate">>): Promise<{ data: Todo; rateLimit: RateLimitInfo }> {
    return this.request<Todo>(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteTodo(id: string): Promise<{ data: undefined; rateLimit: RateLimitInfo }> {
    return this.request<undefined>(`/todos/${id}`, { method: "DELETE" });
  }
}
