import { Todo, PaginatedResponse, RateLimitInfo } from "./types.js";

export interface ListTodosOptions {
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

  private async request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; rateLimit: RateLimitInfo }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...(options.headers as Record<string, string> ?? {}),
    };

    let response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });

    if (response.status === 429) {
      const resetHeader = response.headers.get("X-RateLimit-Reset");
      const resetMs = resetHeader ? (Number(resetHeader) * 1000 - Date.now()) : 1000;
      const delay = Math.max(resetMs, 0);
      await new Promise((r) => setTimeout(r, delay));
      response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    }

    const rateLimit: RateLimitInfo = {
      limit: Number(response.headers.get("X-RateLimit-Limit") ?? 0),
      remaining: Number(response.headers.get("X-RateLimit-Remaining") ?? 0),
      resetAt: Number(response.headers.get("X-RateLimit-Reset") ?? 0),
    };

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API error ${response.status}: ${body}`);
    }

    if (response.status === 204) {
      return { data: undefined as T, rateLimit };
    }

    const data = (await response.json()) as T;
    return { data, rateLimit };
  }

  async listTodos(opts?: ListTodosOptions): Promise<{ data: Todo[]; rateLimit: RateLimitInfo }> {
    const params = new URLSearchParams();
    if (opts?.page !== undefined) params.set("page", String(opts.page));
    if (opts?.pageSize !== undefined) params.set("pageSize", String(opts.pageSize));
    if (opts?.overdue) params.set("overdue", "true");
    const query = params.toString();
    const path = `/todos${query ? `?${query}` : ""}`;
    return this.request<Todo[]>(path);
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
