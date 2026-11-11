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
const LUT_N = 4096;
let LIN_LUT: Float32Array | null = null; // sRGB 0..1 -> linear, for smoothed (non-integer) values
let OUT: Float32Array | null = null; // linear 0..1 -> sRGB 0..255 (unrounded, so we can dither)
function luts() {
  if (!OUT || !LIN_LUT) {
    OUT = new Float32Array(LUT_N + 1);
    LIN_LUT = new Float32Array(LUT_N + 1);
    for (let i = 0; i <= LUT_N; i++) {
      const c = i / LUT_N;
      OUT[i] = 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
      LIN_LUT[i] = toLin(c);
    }
  }
  return { out: OUT, linLut: LIN_LUT };
}
const hexLin = (hex: string) => [1, 3, 5].map((i) => LIN[parseInt(hex.slice(i, i + 2), 16)]);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** How much of a pixel is white paint (0..1): bright and near-neutral. Inputs may be smoothed (non-integer). */
export function paintMask(r: number, g: number, b: number): number {
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  return smooth(0.34, 0.55, L) * (1 - smooth(0.08, 0.2, chroma));
}
const maskFrom = (L: number, chroma: number) => smooth(0.34, 0.55, L) * (1 - smooth(0.08, 0.2, chroma));

// Separable mean / max filters with clamped edges (sliding window, O(1) per pixel for the mean).
function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let sum = src[o] * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[o + Math.min(i, w - 1)];
    for (let x = 0; x < w; x++) {
      dst[o + x] = sum / k;
      sum += src[o + Math.min(x + r + 1, w - 1)] - src[o + Math.max(x - r, 0)];
    }
  }
}
function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const k = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    let sum = src[x] * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[Math.min(i, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / k;
      sum += src[Math.min(y + r + 1, h - 1) * w + x] - src[Math.max(y - r, 0) * w + x];
    }
  }
}
function box(src: Float32Array, dst: Float32Array, tmp: Float32Array, w: number, h: number, r: number) {
  boxH(src, tmp, w, h, r);
  boxV(tmp, dst, w, h, r);
}
function dilate(src: Float32Array, dst: Float32Array, tmp: Float32Array, w: number, h: number, r: number) {
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let i = Math.max(0, x - r), e = Math.min(w - 1, x + r); i <= e; i++) if (src[o + i] > m) m = src[o + i];
      tmp[o + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let j = Math.max(0, y - r), e = Math.min(h - 1, y + r); j <= e; j++) if (tmp[j * w + x] > m) m = tmp[j * w + x];
      dst[y * w + x] = m;
    }
  }
}

/**
 * Recolour a w x h RGBA render in place: the white paint takes the new tone, keeping the render's shading and highlights.
 * The renders are compressed WebPs, so the shading is first cleaned with an edge-preserving (guided) filter and the
 * paint mask is smoothed; otherwise compression blocks and edge speckle get amplified into visible pixelation once
 * the paint is darker than white. Exposure is normalised to each render's own paint so very bright renders don't wash out.
 */
export function tintPixels(px: Uint8ClampedArray, w: number, h: number, hex: string): void {
  const n = w * h;
  if (!n || px.length < n * 4) return;
  const [cr, cg, cb] = hexLin(hex);
  const { out, linLut } = luts();
  const sc = Math.max(1, w / 960);
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n), T = new Float32Array(n);

  // 1) Edge-preserving smooth of the luma (guided filter, guide = itself): flattens compression blocks, keeps panel lines.
  for (let i = 0, j = 0; i < n; i++, j += 4) { const v = (0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2]) / 255; L[i] = v; B[i] = v * v; }
  const r = Math.max(2, Math.round(3 * sc)), eps = 0.0008;
  box(L, A, T, w, h, r); // mean
  box(B, B, T, w, h, r); // mean of squares
  for (let i = 0; i < n; i++) { const m = A[i], v = B[i] - m * m, a = v / (v + eps); A[i] = a; B[i] = m - a * m; }
  box(A, A, T, w, h, r);
  box(B, B, T, w, h, r);
  for (let i = 0; i < n; i++) A[i] = A[i] * L[i] + B[i]; // A = smoothed luma (sRGB 0..1)

  // 2) Paint mask from the smoothed luma and a lightly blurred chroma, grown a touch and feathered so edges stay clean.
  for (let i = 0, j = 0; i < n; i++, j += 4) { const R = px[j], G = px[j + 1], Bl = px[j + 2]; L[i] = (Math.max(R, G, Bl) - Math.min(R, G, Bl)) / 255; }
  box(L, L, T, w, h, Math.max(1, Math.round(2 * sc)));
  for (let i = 0; i < n; i++) B[i] = maskFrom(A[i], L[i]);
  const rr = Math.max(1, Math.round(sc));
  dilate(B, L, T, w, h, rr);
  box(L, B, T, w, h, rr); // B = mask

  // 3) Exposure reference from the paint itself (median + near-peak of linear luma where it's clearly paint).
  const HB = 1024, hist = new Uint32Array(HB);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const ll = linLut[Math.round(clamp01(A[i]) * LUT_N)];
    L[i] = ll; // L = smoothed linear luma
    if (B[i] > 0.5) { hist[Math.min(HB - 1, (ll * HB) | 0)]++; count++; }
  }
  let ref = 0.5, hi = 0.88;
  if (count > 50) {
    let acc = 0, gotRef = false;
    for (let k = 0; k < HB; k++) {
      acc += hist[k];
      if (!gotRef && acc >= count * 0.5) { ref = (k + 0.5) / HB; gotRef = true; }
      if (acc >= count * 0.97) { hi = (k + 0.5) / HB; break; }
    }
  }
  ref = Math.max(ref, 0.05);
  const s0 = hi * 0.85, s1 = Math.min(1, hi * 1.02 + 0.02);

  // 4) Paint, with a tiny dither so dark colours don't band.
  let seed = 0x9e3779b9;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const m = B[i];
    if (m <= 0.002) continue;
    const lr = LIN[px[j]], lg = LIN[px[j + 1]], lb = LIN[px[j + 2]];
    const Ll = L[i];
    const s = Math.min(1.25, (Ll / ref) * 0.72);
    const shade = Math.pow(s, 1.8);
    const spec = smooth(s0, s1, Ll) * 0.2 + 0.008 * s;
    let nr = cr * shade, ng = cg * shade, nb = cb * shade;
    nr += (1 - nr) * spec; ng += (1 - ng) * spec; nb += (1 - nb) * spec;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const d = ((seed >>> 0) / 4294967296 - 0.5) * m;
    px[j] = out[Math.round(clamp01(lr + (nr - lr) * m) * LUT_N)] + d;
    px[j + 1] = out[Math.round(clamp01(lg + (ng - lg) * m) * LUT_N)] + d;
    px[j + 2] = out[Math.round(clamp01(lb + (nb - lb) * m) * LUT_N)] + d;
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
    tintPixels(data.data, w, h, hex);
    ctx.putImageData(data, 0, 0);
    return true;
  } catch {
    return false;
  }
}
