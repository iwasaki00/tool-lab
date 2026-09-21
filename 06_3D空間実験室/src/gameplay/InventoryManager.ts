export interface InventoryEntry { id: string; name: string; count: number }

export class InventoryManager {
  private readonly items = new Map<string, InventoryEntry>();
  constructor(private readonly onChange: (items: InventoryEntry[]) => void, private readonly onItemAdded: (item: InventoryEntry, amount: number) => void = () => undefined) {}

  add(id: string, name: string, amount = 1): void {
    const current = this.items.get(id);
    const item = { id, name, count: (current?.count ?? 0) + amount };
    this.items.set(id, item);
    this.onItemAdded({ ...item }, amount);
    this.onChange(this.entries());
  }

  has(id: string, amount = 1): boolean { return (this.items.get(id)?.count ?? 0) >= amount; }
  entries(): InventoryEntry[] { return [...this.items.values()].map((item) => ({ ...item })); }
  clear(): void { this.items.clear(); this.onChange([]); }
}
