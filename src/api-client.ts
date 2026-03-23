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

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const rateLimitInfo = this.parseRateLimitHeaders(res);
    if (res.status === 429 && rateLimitInfo) {
      const waitMs = Math.max(0, rateLimitInfo.resetAt - Date.now());
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.request<T>(path, options);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  private parseRateLimitHeaders(res: Response): RateLimitInfo | null {
    const limit = res.headers.get("X-RateLimit-Limit");
    const remaining = res.headers.get("X-RateLimit-Remaining");
    const reset = res.headers.get("X-RateLimit-Reset");
    if (!limit || !remaining || !reset) return null;
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      resetAt: parseInt(reset, 10),
    };
  }

  async listTodos(opts?: ListTodosOptions): Promise<Todo[] | PaginatedResponse<Todo>> {
    const params = new URLSearchParams();
    if (opts?.page !== undefined) params.set("page", String(opts.page));
    if (opts?.pageSize !== undefined) params.set("pageSize", String(opts.pageSize));
    if (opts?.overdue) params.set("overdue", "true");
    const query = params.toString();
    const path = `/todos${query ? `?${query}` : ""}`;
    return this.request<Todo[] | PaginatedResponse<Todo>>(path);
  }

  async createTodo(title: string): Promise<Todo> {
    return this.request<Todo>("/todos", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }

  async updateTodo(id: string, updates: Partial<Pick<Todo, "title" | "completed" | "dueDate">>): Promise<Todo> {
    return this.request<Todo>(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteTodo(id: string): Promise<void> {
    return this.request<void>(`/todos/${id}`, {
      method: "DELETE",
    });
  }
}
