export type WebhookEvent =
  | "todo.created"
  | "todo.updated"
  | "todo.deleted"
  | "todo.bulk_created"
  | "todo.bulk_deleted";

export class WebhookManager {
  private urls = new Set<string>();
  private _notificationCount = 0;

  register(url: string): void {
    this.urls.add(url);
  }

  unregister(url: string): boolean {
    return this.urls.delete(url);
  }

  notify(event: WebhookEvent, data: unknown): void {
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    for (const url of this.urls) {
      this._notificationCount++;
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).catch(() => {});
    }
  }

  get registeredUrls(): string[] {
    return [...this.urls];
  }

  get notificationCount(): number {
    return this._notificationCount;
  }
}
