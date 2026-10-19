import { boundaryRadius, type AnimationState } from './animation';

export class SphereRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private pixelRatio = 1;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas 2D is not supported.');
    this.canvas = canvas;
    this.context = context;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
  }

  draw(state: AnimationState): void {
    const ctx = this.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.width || !this.height) return;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    const radius = Math.min(this.width, this.height) * 0.32;
    const energy = state.energy;
    const boundary = new Path2D();

    // These vertices sample four shared waves; no vertex has independent motion.
    const samples = 144;
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const r = radius * boundaryRadius(angle, state);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) boundary.moveTo(x, y);
      else boundary.lineTo(x, y);
    }
    boundary.closePath();

    const interior = ctx.createRadialGradient(-radius * 0.12, -radius * 0.08, 0, 0, 0, radius * 1.15);
    interior.addColorStop(0, `rgba(171, 92, 255, ${0.22 + energy * 0.14})`);
    interior.addColorStop(0.55, `rgba(93, 35, 175, ${0.28 + energy * 0.16})`);
    interior.addColorStop(0.86, `rgba(148, 37, 123, ${0.30 + energy * 0.12})`);
    interior.addColorStop(1, 'rgba(231, 43, 70, 0.36)');
    ctx.fillStyle = interior;
    ctx.fill(boundary);

    ctx.lineJoin = 'round';
    ctx.shadowColor = '#ff243e';
    ctx.shadowBlur = radius * (0.13 + energy * 0.04);
    ctx.strokeStyle = `rgba(255, 35, 58, ${0.40 + energy * 0.12})`;
    ctx.lineWidth = radius * (0.047 + energy * 0.014);
    ctx.stroke(boundary);

    ctx.shadowBlur = radius * 0.055;
    ctx.strokeStyle = `rgba(255, 93, 109, ${0.70 + energy * 0.14})`;
    ctx.lineWidth = radius * 0.012;
    ctx.stroke(boundary);
    ctx.restore();
  }
}
