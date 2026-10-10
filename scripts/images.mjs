// Responsive WebP variants for the images used by the new pages. Originals stay in /images/.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const WIDTHS = [480, 800, 1200];
const SOURCES = {
  'nikolay-hero': 'nikolay-hero.jpeg',
  'nikolay-about': 'nikolay-about.jpeg',
  'nekov-speaking-4': 'nekov-speaking-4.jpeg',
  'nekov-speaking-5': 'nekov-speaking-5.jpeg',
  'jaya-website': 'jaya-website.png',
};

export async function buildImages(root, out) {
  mkdirSync(join(out, 'img'), { recursive: true });
  const manifest = {};
  for (const [name, file] of Object.entries(SOURCES)) {
    const src = join(root, 'images', file);
    const { width, height } = await sharp(src).metadata();
    const widths = WIDTHS.filter((w) => w < width).concat(Math.min(width, 1200)).filter((w, i, a) => a.indexOf(w) === i);
    for (const w of widths) {
      await sharp(src).resize({ width: w }).webp({ quality: 78 }).toFile(join(out, 'img', `${name}-${w}.webp`));
    }
    manifest[name] = { ratio: width / height, widths };
  }
  return manifest;
}

/** <img> with srcset and explicit dimensions (no layout shift). */
export function pic(manifest, name, { alt = '', sizes = '100vw', eager = false, cls = 'photo' } = {}) {
  const m = manifest[name];
  const max = m.widths[m.widths.length - 1];
  const srcset = m.widths.map((w) => `/img/${name}-${w}.webp ${w}w`).join(', ');
  const h = Math.round(max / m.ratio);
  return `<img class="${cls}" src="/img/${name}-${max}.webp" srcset="${srcset}" sizes="${sizes}" width="${max}" height="${h}" alt="${alt.replace(/"/g, '&quot;')}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}>`;
}
