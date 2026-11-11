// Colour matching for the generic body renders (public/cars/*.svg, white paint on the brand backdrop).
// The DVSA colour picks a paint tone; only the paint is recoloured. Glass, tyres, lights, trim and the
// backdrop are dark or saturated, so a luminance + low-chroma mask leaves them untouched, and the white
// paint's own shading drives the new colour (luminosity-preserving, plus a clear-coat highlight).
// Purely decorative: it never shows the visitor's actual car.

/** DVSA colour name -> automotive paint tone (sRGB). null = keep the original white render. */
const PAINT: Record<string, string | null> = {
  WHITE: null,
  CREAM: "#D9D0BA",
  BLACK: "#141518",
  SILVER: "#A3A7AC",
  GREY: "#5E6268",
  RED: "#8E1A1F",
  MAROON: "#561821",
  BLUE: "#1F3F7A",
  GREEN: "#2D4C3A",
  YELLOW: "#D9A92C",
  ORANGE: "#C55A20",
  BEIGE: "#B5A487",
  BRONZE: "#7A5536",
  GOLD: "#A8894C",
  BROWN: "#4B3729",
  PURPLE: "#46305F",
  PINK: "#C27A8D",
  TURQUOISE: "#1D7C84",
  "MULTI-COLOUR": null,
};

/** Paint hex for a DVSA colour, or null when it should stay white (white, multi-colour, unknown, blank). */
export function paintFor(colour?: string | null): string | null {
  const k = (colour ?? "").trim().toUpperCase().replace(/\s+/g, " ").replace(/^MULTI[\s-]?COLOU?R(ED)?$/, "MULTI-COLOUR").replace(/^GRAY$/, "GREY");
  return Object.prototype.hasOwnProperty.call(PAINT, k) ? PAINT[k] : null;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const LIN = new Float32Array(256).map((_, i) => toLin(i / 255));
const OUT_N = 4096;
let OUT: Uint8ClampedArray | null = null;
function outLut() {
  if (OUT) return OUT;
  OUT = new Uint8ClampedArray(OUT_N + 1);
  for (let i = 0; i <= OUT_N; i++) { const c = i / OUT_N; OUT[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
  return OUT;
}
const hexLin = (hex: string) => [1, 3, 5].map((i) => LIN[parseInt(hex.slice(i, i + 2), 16)]);

/** How much of a pixel is white paint (0..1): bright and near-neutral. */
export function paintMask(r: number, g: number, b: number): number {
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  return smooth(0.34, 0.55, L) * (1 - smooth(0.08, 0.2, chroma));
}

/** Recolour RGBA pixels in place: paint takes the new tone, keeping the render's shading and highlights. */
export function tintPixels(px: Uint8ClampedArray, hex: string): void {
  const [cr, cg, cb] = hexLin(hex);
  const out = outLut();
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const m = paintMask(r, g, b);
    if (m <= 0.002) continue;
    const lr = LIN[r], lg = LIN[g], lb = LIN[b];
    const Ll = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    const s = Math.min(1.3, Ll / 0.68);
    const shade = Math.pow(s, 1.8);
    const spec = smooth(0.62, 0.85, Ll) * 0.22 + 0.008 * s;
    let nr = cr * shade, ng = cg * shade, nb = cb * shade;
    nr += (1 - nr) * spec; ng += (1 - ng) * spec; nb += (1 - nb) * spec;
    px[i] = out[Math.round(Math.min(1, lr + (nr - lr) * m) * OUT_N)];
    px[i + 1] = out[Math.round(Math.min(1, lg + (ng - lg) * m) * OUT_N)];
    px[i + 2] = out[Math.round(Math.min(1, lb + (nb - lb) * m) * OUT_N)];
  }
}

const sources = new Map<string, Promise<HTMLImageElement>>();
/** The renders are SVGs wrapping one WebP; decode the WebP itself so the canvas is never tainted. */
function loadRender(src: string): Promise<HTMLImageElement> {
  let p = sources.get(src);
  if (!p) {
    p = fetch(src).then((r) => r.text()).then((svg) => {
      const m = svg.match(/href="(data:image\/[a-z]+;base64,[^"]+)"/);
      if (!m) throw new Error("render: no embedded image");
      const img = new Image();
      img.decoding = "async";
      img.src = m[1];
      return img.decode().then(() => img);
    });
    p.catch(() => sources.delete(src));
    sources.set(src, p);
  }
  return p;
}

/** Paint a body render onto a canvas in the given tone. Resolves false if it could not be done. */
export async function paintRender(canvas: HTMLCanvasElement, src: string, hex: string): Promise<boolean> {
  try {
    const img = await loadRender(src);
    const w = img.naturalWidth || 960, h = img.naturalHeight || 540;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    tintPixels(data.data, hex);
    ctx.putImageData(data, 0, 0);
    return true;
  } catch {
    return false;
  }
}
