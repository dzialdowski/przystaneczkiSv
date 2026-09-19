import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// 1. Logo SVG (App Icon - Przystaneczki Gdynia)
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#0a0f1d" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>

    <!-- Amber Glow Gradient -->
    <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="60%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>

    <!-- Cyan Coastal Glow Gradient -->
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>

    <!-- Gold Accent Rim Gradient -->
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.7" />
    </linearGradient>

    <!-- Trolleybus poles glow -->
    <linearGradient id="poleGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#94a3b8" />
      <stop offset="70%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>

    <!-- Filter for subtle drop shadow and glow -->
    <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Base Icon Background (Squircle) -->
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#bgGrad)" />
  <!-- Glowing Rim Border -->
  <rect x="17" y="17" width="478" height="478" rx="111" ry="111" fill="none" stroke="url(#rimGrad)" stroke-width="3.5" />

  <!-- Background Decorative Grid & Realtime Radar Waves -->
  <g opacity="0.12">
    <circle cx="256" cy="256" r="180" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6 6" />
    <circle cx="256" cy="256" r="220" fill="none" stroke="#f59e0b" stroke-width="1.5" />
    <line x1="256" y1="50" x2="256" y2="460" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 8" />
  </g>

  <!-- Gdynia Baltic Sea Wave (Lower Accent representing coastal transit) -->
  <path d="M 64 390 C 130 360, 180 410, 256 385 C 330 360, 380 405, 448 375 L 448 420 C 400 440, 330 435, 256 425 C 180 415, 120 440, 64 425 Z"
        fill="url(#cyanGrad)" opacity="0.35" />

  <!-- Transit Shelter Arch ("Przystanek" Canopy silhouette) -->
  <path d="M 120 220 C 120 160, 190 140, 256 140 C 322 140, 392 160, 392 220"
        fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" opacity="0.4" />

  <!-- Trolleybus Pantograph Poles (Gdynia Trapeze) -->
  <g stroke-linecap="round">
    <!-- Left Pole -->
    <line x1="220" y1="205" x2="165" y2="92" stroke="url(#poleGrad)" stroke-width="6.5" />
    <!-- Right Pole -->
    <line x1="292" y1="205" x2="347" y2="92" stroke="url(#poleGrad)" stroke-width="6.5" />
    <!-- Trolley Collectors (Contact Shoes) -->
    <rect x="150" y="86" width="30" height="7" rx="3.5" fill="#fbbf24" filter="url(#amberGlow)" />
    <rect x="332" y="86" width="30" height="7" rx="3.5" fill="#fbbf24" filter="url(#amberGlow)" />
    <!-- Overhead Contact Wire -->
    <line x1="100" y1="89" x2="412" y2="89" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="8 6" opacity="0.5" />
    <!-- Electric spark / telemetry dot -->
    <circle cx="256" cy="89" r="5" fill="#38bdf8" filter="url(#amberGlow)" />
  </g>

  <!-- Bus / Trolleybus Body Silhouette -->
  <g filter="url(#softShadow)">
    <!-- Main Body Container -->
    <rect x="148" y="195" width="216" height="190" rx="38" ry="38" fill="url(#amberGrad)" />

    <!-- Sleek Panoramic Windshield (Dark Glass) -->
    <path d="M 166 250 L 166 230 C 166 215, 178 206, 194 206 L 318 206 C 334 206, 346 215, 346 230 L 346 250 C 346 258, 340 264, 332 264 L 180 264 C 172 264, 166 258, 166 250 Z"
          fill="#090d16" />

    <!-- Windshield Reflection Highlight -->
    <path d="M 176 214 L 230 214 L 195 256 L 174 256 Z" fill="#ffffff" opacity="0.12" />

    <!-- Amber LED Destination Matrix Display -->
    <rect x="194" y="213" width="124" height="16" rx="4" fill="#000000" />
    <!-- LED Matrix Dots / Text simulation -->
    <g fill="#fbbf24">
      <circle cx="206" cy="221" r="2" />
      <circle cx="214" cy="221" r="2" />
      <circle cx="222" cy="221" r="2" />
      <circle cx="230" cy="221" r="2" />
      <circle cx="238" cy="221" r="2" />
      <circle cx="246" cy="221" r="2" />
      <circle cx="254" cy="221" r="2" />
      <circle cx="262" cy="221" r="2" />
      <circle cx="270" cy="221" r="2" />
      <circle cx="278" cy="221" r="2" />
      <circle cx="286" cy="221" r="2" />
      <circle cx="294" cy="221" r="2" />
      <circle cx="302" cy="221" r="2" />
      <circle cx="310" cy="221" r="2" />
    </g>

    <!-- Lower Grill & Bumper Design -->
    <rect x="206" y="322" width="100" height="24" rx="8" fill="#090d16" />
    <!-- Grille lines -->
    <line x1="220" y1="330" x2="292" y2="330" stroke="#334155" stroke-width="2" stroke-linecap="round" />
    <line x1="224" y1="337" x2="288" y2="337" stroke="#334155" stroke-width="2" stroke-linecap="round" />

    <!-- Modern LED Headlights (Glowing Angel Eyes) -->
    <!-- Left Headlight -->
    <g filter="url(#amberGlow)">
      <rect x="164" y="286" width="30" height="14" rx="7" fill="#ffffff" />
      <circle cx="179" cy="293" r="4.5" fill="#38bdf8" />
    </g>
    <!-- Right Headlight -->
    <g filter="url(#amberGlow)">
      <rect x="318" y="286" width="30" height="14" rx="7" fill="#ffffff" />
      <circle cx="333" cy="293" r="4.5" fill="#38bdf8" />
    </g>

    <!-- Daytime Running Light Strip (DRL) -->
    <path d="M 166 280 L 196 280" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.9" />
    <path d="M 316 280 L 346 280" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.9" />

    <!-- Central "P" Transit Roundel (Przystaneczki Badge on Bus) -->
    <circle cx="256" cy="293" r="14" fill="#090d16" stroke="#fbbf24" stroke-width="2" />
    <text x="256" y="299" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="14" fill="#fbbf24" text-anchor="middle">P</text>

    <!-- Wheels / Chassis base -->
    <rect x="156" y="378" width="32" height="12" rx="4" fill="#0f172a" />
    <rect x="324" y="378" width="32" height="12" rx="4" fill="#0f172a" />
  </g>

  <!-- Live Pulse Waves (Signifying TRISTAR Live Tracking) -->
  <g>
    <circle cx="256" cy="436" r="6" fill="#38bdf8" filter="url(#amberGlow)" />
    <path d="M 236 436 A 20 20 0 0 1 276 436" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
    <path d="M 222 436 A 34 34 0 0 1 290 436" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.5" />
    <path d="M 208 436 A 48 48 0 0 1 304 436" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.3" />
  </g>
</svg>`;

// 2. Klima Icon SVG (Air Conditioning / Cool Climate)
// Clean 24x24 pixel grid vector icon: modern ice snowflake with cooling breeze
const klimaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <linearGradient id="klimaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
  </defs>
  <!-- Drop shadow background for legibility on any backdrop -->
  <g stroke="url(#klimaGrad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <!-- Vertical Spine -->
    <line x1="12" y1="2.5" x2="12" y2="21.5" />
    <!-- Diagonal Spines -->
    <line x1="3.8" y1="7.25" x2="20.2" y2="16.75" />
    <line x1="3.8" y1="16.75" x2="20.2" y2="7.25" />

    <!-- Top & Bottom Arrows / V-branches -->
    <path d="M 9.5 5 L 12 3 L 14.5 5" />
    <path d="M 9.5 19 L 12 21 L 14.5 19" />

    <!-- Diagonal V-branches -->
    <path d="M 5 10 L 4 7.5 L 6.8 7.5" />
    <path d="M 19 14 L 20 16.5 L 17.2 16.5" />
    <path d="M 6.8 16.5 L 4 16.5 L 5 14" />
    <path d="M 17.2 7.5 L 20 7.5 L 19 10" />
  </g>
  <!-- Central Ice Core -->
  <circle cx="12" cy="12" r="2.2" fill="#38bdf8" />
</svg>`;

// 3. USB Icon SVG (USB Charger / Power)
// Clean 24x24 pixel grid vector icon: crisp USB trident symbol with power accents
const usbSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <linearGradient id="usbGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>
  </defs>
  <g stroke="url(#usbGrad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <!-- Main Center Stem -->
    <line x1="12" y1="4.5" x2="12" y2="18.5" />

    <!-- Left Branch -->
    <path d="M 8 10.5 L 8 13.5 C 8 15.5 12 15.5 12 15.5" />

    <!-- Right Branch -->
    <path d="M 16 9 L 16 12 C 16 14.5 12 14.5 12 14.5" />
  </g>

  <!-- Terminals -->
  <!-- Top Center Arrow -->
  <polygon points="12,2 9,6 15,6" fill="#34d399" />

  <!-- Left Branch Square -->
  <rect x="6.5" y="8.5" width="3" height="3" rx="0.5" fill="#34d399" />

  <!-- Right Branch Circle -->
  <circle cx="16" cy="8" r="1.8" fill="#34d399" />

  <!-- Bottom Base Circle -->
  <circle cx="12" cy="19.5" r="2" fill="#10b981" />
</svg>`;

async function main() {
  console.log('Starting asset generation...');

  // Save SVGs
  fs.writeFileSync('static/logo.svg', logoSvg.trim());
  fs.writeFileSync('src/lib/assets/favicon.svg', logoSvg.trim());
  fs.writeFileSync('static/favicon.svg', logoSvg.trim());
  fs.writeFileSync('static/Klima.svg', klimaSvg.trim());
  fs.writeFileSync('static/USB.svg', usbSvg.trim());
  console.log('Saved SVG files.');

  // Launch browser for pixel-perfect PNG rendering
  const browser = await chromium.launch({ channel: 'msedge' });
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  // Helper to render HTML/SVG directly to PNG
  async function renderSvgToPng(svgContent, width, height, outputPath) {
    const html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: ${width}px; height: ${height}px; background: transparent; overflow: hidden; }
          svg { width: 100%; height: 100%; display: block; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>`;

    await page.setViewportSize({ width, height });
    await page.setContent(html, { waitUntil: 'load' });
    const buf = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width, height }
    });
    fs.writeFileSync(outputPath, buf);
    console.log(`Rendered ${outputPath} (${width}x${height}, ${buf.length} bytes)`);
  }

  // 1. Render App Icons:
  // nice-higherres.png: 512x512
  await renderSvgToPng(logoSvg, 512, 512, 'static/nice-higherres.png');

  // nice-highres.png: 192x192
  await renderSvgToPng(logoSvg, 192, 192, 'static/nice-highres.png');

  // 2. Render Amenities Icons (24x24):
  await renderSvgToPng(klimaSvg, 24, 24, 'static/Klima.png');
  await renderSvgToPng(usbSvg, 24, 24, 'static/USB.png');

  await browser.close();
  console.log('Asset generation completed successfully!');
}

main().catch(console.error);
