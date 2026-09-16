export interface Dialogue { speaker: string; text: string }
export type DialogueSequence = Dialogue[];

export class DialogueManager {
  private readonly panel = document.querySelector<HTMLElement>("#dialogue-panel");
  private readonly speaker = document.querySelector<HTMLElement>("#dialogue-speaker");
  private readonly text = document.querySelector<HTMLElement>("#dialogue-text");
  private readonly next = document.querySelector<HTMLButtonElement>("#dialogue-next");
  private sequence: DialogueSequence = [];
  private index = 0;
  private openState = false;
  private readonly nextHandler: (event: Event) => void;
  private readonly keyHandler: (event: KeyboardEvent) => void;

  constructor(private readonly onPauseChange: (paused: boolean) => void) {
    this.nextHandler = (event) => { event.preventDefault(); event.stopPropagation(); this.advance(); };
    this.keyHandler = (event) => { if (this.openState && (event.code === "KeyE" || event.code === "Escape" || event.code === "Enter")) { event.preventDefault(); this.advance(); } };
    this.next?.addEventListener("pointerdown", this.nextHandler, { passive: false });
    document.addEventListener("keydown", this.keyHandler);
  }

  open(sequence: DialogueSequence): void {
    if (!sequence.length) return;
    this.sequence = sequence; this.index = 0; this.openState = true; this.onPauseChange(true); this.render();
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false; this.panel?.classList.remove("is-visible"); this.onPauseChange(false);
  }

  isOpen(): boolean { return this.openState; }
  dispose(): void { this.close(); this.next?.removeEventListener("pointerdown", this.nextHandler); document.removeEventListener("keydown", this.keyHandler); }

  private advance(): void { if (++this.index >= this.sequence.length) this.close(); else this.render(); }
  private render(): void {
    const line = this.sequence[this.index]; if (!line) return;
    if (this.speaker) this.speaker.textContent = line.speaker;
    if (this.text) this.text.textContent = line.text;
    if (this.next) this.next.textContent = this.index === this.sequence.length - 1 ? "閉じる" : "次へ";
    this.panel?.classList.add("is-visible");
  }
}
