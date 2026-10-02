// Builds the low-bandwidth image set from public/images/*.jpg (run after adding photos):
//   <name>-480.webp, <name>-960.webp  — served through <picture> with the JPEG as a fallback (iOS 13)
//   <name>-1400.webp                  — also, for originals at least 1400 px wide (full-width heroes)
//   public/icons/*.png                — PWA icons rendered from public/favicon.svg
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const root = new URL('../public/', import.meta.url).pathname;
const images = join(root, 'images');

// Photos shown under a dark wash (the home hero) can be compressed harder without visible loss
const QUALITY = { 'hero-nursery-beds': 40, 'greenhouse-kamuli': 46 };

for (const file of (await readdir(images)).filter(f => f.endsWith('.jpg'))) {
  const base = file.replace(/\.jpg$/, '');
  const { width: original = 0 } = await sharp(join(images, file)).metadata();
  for (const width of original >= 1400 ? [480, 960, 1400] : [480, 960]) {
    const info = await sharp(join(images, file))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY[base] ?? 55, effort: 6, smartSubsample: true })
      .toFile(join(images, `${base}-${width}.webp`));
    console.log(`${base}-${width}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
  }
}

const icons = join(root, 'icons');
await mkdir(icons, { recursive: true });
const svg = await readFile(join(root, 'favicon.svg'));
for (const size of [192, 512]) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(join(icons, `icon-${size}.png`));
}
// Maskable: the mark inside the safe zone on a full-bleed cream background (the mark's own tile)
const inner = await sharp(svg, { density: 512 }).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#faf6ee' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(join(icons, 'icon-maskable-512.png'));
console.log('PWA icons written');
