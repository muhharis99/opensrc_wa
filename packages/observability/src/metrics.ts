export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();

  public increment(name: string, by = 1): void { this.counters.set(name, (this.counters.get(name) ?? 0) + by); }
  public gauge(name: string, value: number): void { this.gauges.set(name, value); }

  public snapshot(): Record<string, number> {
    return Object.fromEntries([...this.counters, ...this.gauges]);
  }

  public toPrometheus(): string {
    return Object.entries(this.snapshot()).map(([name, value]) => `${sanitize(name)} ${value}`).join("\n") + "\n";
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_:]/g, "_");
}
