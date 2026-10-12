/**
 * OneEuroFilter implementation for smoothing 1D, 2D, and 3D landmark coordinates and angles.
 * Casiez, G., Roussel, N. and Vogel, F. (2012).
 * 1 € Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Human-Computer Interaction.
 */

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  constructor(private alpha: number = 0.5) {}

  filter(value: number, alpha?: number): number {
    if (alpha !== undefined) this.alpha = alpha;
    if (this.y === null) {
      this.s = value;
      this.y = value;
    } else {
      this.y = this.alpha * value + (1.0 - this.alpha) * this.s!;
      this.s = this.y;
    }
    return this.y;
  }

  hasLast(): boolean {
    return this.y !== null;
  }

  last(): number {
    return this.y ?? 0;
  }

  reset() {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  constructor(
    private freq: number = 60,
    private minCutoff: number = 1.0,
    private beta: number = 0.007,
    private dCutoff: number = 1.0
  ) {
    this.xFilter = new LowPassFilter(this.alpha(minCutoff));
    this.dxFilter = new LowPassFilter(this.alpha(dCutoff));
  }

  private alpha(cutoff: number): number {
    const te = 1.0 / this.freq;
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(x: number, timestamp?: number): number {
    if (timestamp !== undefined && this.lastTime !== null) {
      const dt = (timestamp - this.lastTime) / 1000.0;
      if (dt > 0) {
        this.freq = 1.0 / dt;
      }
    }
    this.lastTime = timestamp ?? performance.now();

    const prevX = this.xFilter.hasLast() ? this.xFilter.last() : x;
    const dx = (x - prevX) * this.freq;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    return this.xFilter.filter(x, this.alpha(cutoff));
  }

  reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

/**
 * 2D Point Filter using 1-Euro Filter for x and y
 */
export class OneEuroPoint2D {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor(minCutoff: number = 0.8, beta: number = 0.015) {
    this.filterX = new OneEuroFilter(60, minCutoff, beta);
    this.filterY = new OneEuroFilter(60, minCutoff, beta);
  }

  filter(x: number, y: number, timestamp?: number): { x: number; y: number } {
    return {
      x: this.filterX.filter(x, timestamp),
      y: this.filterY.filter(y, timestamp)
    };
  }

  reset() {
    this.filterX.reset();
    this.filterY.reset();
  }
}

/**
 * Transform Filter (x, y, scale, rotationAngle)
 */
export class OneEuroTransform {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;
  private filterScale: OneEuroFilter;
  private filterAngle: OneEuroFilter;

  constructor(minCutoff: number = 0.7, beta: number = 0.02) {
    this.filterX = new OneEuroFilter(60, minCutoff, beta);
    this.filterY = new OneEuroFilter(60, minCutoff, beta);
    this.filterScale = new OneEuroFilter(60, minCutoff, beta);
    // Smooth angle filter
    this.filterAngle = new OneEuroFilter(60, minCutoff * 0.8, beta * 0.5);
  }

  filter(x: number, y: number, scale: number, angle: number, timestamp?: number) {
    return {
      x: this.filterX.filter(x, timestamp),
      y: this.filterY.filter(y, timestamp),
      scale: this.filterScale.filter(scale, timestamp),
      angle: this.filterAngle.filter(angle, timestamp)
    };
  }

  reset() {
    this.filterX.reset();
    this.filterY.reset();
    this.filterScale.reset();
    this.filterAngle.reset();
  }
}
