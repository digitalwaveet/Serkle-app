export interface StoryGradientStop {
  offset: number;
  color: string;
}

export interface StoryGradientPreset {
  id: string;
  name: string;
  angle: number;
  stops: StoryGradientStop[];
  css: string;
}

function buildGradientCss(angle: number, stops: StoryGradientStop[]): string {
  const stopList = stops
    .map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`)
    .join(', ');
  return `linear-gradient(${angle}deg, ${stopList})`;
}

function preset(
  id: string,
  name: string,
  stops: StoryGradientStop[],
  angle = 135,
): StoryGradientPreset {
  return {
    id,
    name,
    angle,
    stops,
    css: buildGradientCss(angle, stops),
  };
}

export const STORY_GRADIENTS: StoryGradientPreset[] = [
  preset('serkle', 'Serkle', [
    { offset: 0, color: '#6342bc' },
    { offset: 0.55, color: '#b63788' },
    { offset: 1, color: '#f19753' },
  ]),
  preset('rosewood', 'Plum', [
    { offset: 0, color: '#4b164c' },
    { offset: 0.55, color: '#8b2671' },
    { offset: 1, color: '#e08ed1' },
  ]),
  preset('sunset', 'Sunset', [
    { offset: 0, color: '#ff512f' },
    { offset: 0.55, color: '#dd2476' },
    { offset: 1, color: '#7b1fa2' },
  ]),
  preset('ocean', 'Ocean', [
    { offset: 0, color: '#1d4ed8' },
    { offset: 0.55, color: '#0ea5e9' },
    { offset: 1, color: '#22d3ee' },
  ]),
  preset('emerald', 'Emerald', [
    { offset: 0, color: '#065f46' },
    { offset: 0.55, color: '#10b981' },
    { offset: 1, color: '#34d399' },
  ]),
  preset('royal', 'Royal', [
    { offset: 0, color: '#312e81' },
    { offset: 0.55, color: '#7c3aed' },
    { offset: 1, color: '#c084fc' },
  ]),
  preset('coral', 'Coral', [
    { offset: 0, color: '#f43f5e' },
    { offset: 0.5, color: '#fb7185' },
    { offset: 1, color: '#fbbf24' },
  ]),
  preset('aurora', 'Aurora', [
    { offset: 0, color: '#0f766e' },
    { offset: 0.55, color: '#6366f1' },
    { offset: 1, color: '#ec4899' },
  ]),
  preset('citrus', 'Citrus', [
    { offset: 0, color: '#f59e0b' },
    { offset: 0.55, color: '#f97316' },
    { offset: 1, color: '#ef4444' },
  ]),
  preset('candy', 'Candy', [
    { offset: 0, color: '#ec4899' },
    { offset: 0.55, color: '#8b5cf6' },
    { offset: 1, color: '#3b82f6' },
  ]),
  preset('midnight', 'Midnight', [
    { offset: 0, color: '#0f172a' },
    { offset: 0.55, color: '#1e293b' },
    { offset: 1, color: '#475569' },
  ]),
  preset('obsidian', 'Obsidian', [
    { offset: 0, color: '#18181b' },
    { offset: 0.55, color: '#27272a' },
    { offset: 1, color: '#09090b' },
  ]),
];

export const DEFAULT_STORY_GRADIENT = STORY_GRADIENTS[0];

export function findStoryGradientByCss(css?: string): StoryGradientPreset | undefined {
  if (!css) return undefined;
  return STORY_GRADIENTS.find((gradient) => gradient.css === css);
}

/**
 * Compute canvas linear-gradient endpoints matching CSS linear-gradient(angleDeg, ...).
 */
export function gradientLineForAngle(angleDeg: number, width: number, height: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const halfLen = (Math.abs(dx) * width + Math.abs(dy) * height) / 2;
  const cx = width / 2;
  const cy = height / 2;
  return {
    x0: cx - dx * halfLen,
    y0: cy - dy * halfLen,
    x1: cx + dx * halfLen,
    y1: cy + dy * halfLen,
  };
}

export async function renderStoryGradientBlob(
  gradient: StoryGradientPreset,
  width = 1080,
  height = 1920,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Your device could not render the story background.');
  }
  const { x0, y0, x1, y1 } = gradientLineForAngle(gradient.angle, width, height);
  const fill = context.createLinearGradient(x0, y0, x1, y1);
  for (const stop of gradient.stops) {
    fill.addColorStop(stop.offset, stop.color);
  }
  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  );
  if (!blob) {
    throw new Error('Could not export the story background.');
  }
  return blob;
}
