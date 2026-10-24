/** One request across capture and inference; tickets never repeat after reset. */
export class FrameGate {
  private next = 0;
  private active: number | null = null;

  begin(): number | null {
    if (this.active !== null) return null;
    this.active = ++this.next;
    return this.active;
  }

  finish(ticket: number): boolean {
    if (ticket !== this.active) return false;
    this.active = null;
    return true;
  }

  reset(): void {
    this.active = null;
  }
}
