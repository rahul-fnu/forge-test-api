export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
}

export interface ApiKeySet {
  key: string;
  name: string;
  createdAt: string;
  expiresAt?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function isTodo(obj: unknown): obj is Todo {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.completed === "boolean" &&
    typeof o.createdAt === "string"
  );
}

export function isValidApiKey(key: unknown): key is string {
  if (typeof key !== "string") return false;
  return key.length >= 16 && /^[a-zA-Z0-9_\-]+$/.test(key);
}

export const DEFAULT_RATE_LIMIT = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const API_VERSION = "v1";
