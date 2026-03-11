const { chromium } = require("playwright");
const { URL } = require("url");
const sharp = require("sharp");

// ── helpers ──────────────────────────────────────────────
const FONT_RE = /\.(woff2?|ttf|otf|eot)(\?|#|$)/i;

function isFontResponse(url, ct) {
  return ct.includes("font/") || ct.includes("application/font") || FONT_RE.test(url);
}

async function fetchTransparentLogo(domain) {
  const token = "pk_LMYBshZrSNWjexfaZvNkAQ";
  const url = `https://img.logo.dev/${domain}?token=${token}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const inputBuffer = Buffer.from(await res.arrayBuffer());

  const metadata = await sharp(inputBuffer).metadata();
  if (metadata.hasAlpha && metadata.format === "png") {
    return { buffer: inputBuffer, alreadyTransparent: true };
  }

  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;

  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
  ];

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (const [x, y] of corners) {
    const off = (y * width + x) * 4;
    rSum += data[off];
    gSum += data[off + 1];
    bSum += data[off + 2];
    count++;
  }

  const bgR = Math.round(rSum / count);
  const bgG = Math.round(gSum / count);
  const bgB = Math.round(bSum / count);

  const TOLERANCE = 35;
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    if (idx < 0 || idx >= width * height || visited[idx]) continue;
    visited[idx] = 1;

    const px = idx * 4;
    const r = data[px], g = data[px + 1], b = data[px + 2];

    const dist = Math.sqrt(
      (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
    );

    if (dist > TOLERANCE) continue;

    const alpha = dist > TOLERANCE * 0.7
      ? Math.round((dist / TOLERANCE) * 255)
      : 0;
    data[px + 3] = alpha;

    const x = idx % width;
    const y = Math.floor(idx / width);

    if (x > 0)          queue.push(idx - 1);
    if (x < width - 1)  queue.push(idx + 1);
    if (y > 0)          queue.push(idx - width);
    if (y < height - 1) queue.push(idx + width);
  }

  const outputBuffer = await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  return { buffer: outputBuffer, alreadyTransparent: false };
}

// ── main ─────────────────────────────────────────────────
async function scrapeDesignTokens(targetUrl) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const seenFontUrls = new Set();
  page.on("response", (resp) => {
    const ct = (resp.headers()["content-type"] || "").toLowerCase();
    if (isFontResponse(resp.url(), ct)) seenFontUrls.add(resp.url());
  });

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });

  // ── FONTS ──────────────────────────────────────────────
  const { fontFaceMap, headerFamily, bodyFamily } = await page.evaluate(() => {
    const map = {};

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (!(rule instanceof CSSFontFaceRule)) continue;

          const family = rule.style
            .getPropertyValue("font-family")
            .replace(/['"]/g, "")
            .trim();
          const weight = rule.style.getPropertyValue("font-weight") || "400";
          const style = rule.style.getPropertyValue("font-style") || "normal";
          const src = rule.style.getPropertyValue("src");

          const urls = [];
          const re = /url\(\s*["']?([^"')]+?)["']?\s*\)/g;
          let m;
          while ((m = re.exec(src))) {
            if (!m[1].startsWith("data:")) urls.push(m[1]);
          }

          if (urls.length) {
            const key = family.toLowerCase();
            if (!map[key]) map[key] = [];
            map[key].push({ family, weight, style, urls });
          }
        }
      } catch { /* cross‑origin */ }
    }

    let hFamily = null;
    for (const sel of ["h1", "h2", "h3", "h4", "[class*='heading']", "[class*='title']"]) {
      const el = document.querySelector(sel);
      if (el) {
        hFamily = getComputedStyle(el)
          .fontFamily.split(",")[0]
          .replace(/['"]/g, "")
          .trim();
        break;
      }
    }

    let bFamily = null;
    for (const sel of ["p", "body", "span", "div"]) {
      const el = document.querySelector(sel);
      if (el && getComputedStyle(el).fontFamily) {
        bFamily = getComputedStyle(el)
          .fontFamily.split(",")[0]
          .replace(/['"]/g, "")
          .trim();
        break;
      }
    }

    return { fontFaceMap: map, headerFamily: hFamily, bodyFamily: bFamily };
  });

  function pickUrl(family) {
    if (!family) return null;
    const key = family.toLowerCase();

    let entries =
      fontFaceMap[key] ||
      fontFaceMap[
        Object.keys(fontFaceMap).find(
          (k) => k.includes(key) || key.includes(k)
        )
      ];

    if (entries?.length) {
      const regular =
        entries.find(
          (e) =>
            (e.weight === "400" || e.weight === "normal") &&
            e.style === "normal"
        ) || entries[0];

      const urls = regular.urls;
      const best =
        urls.find((u) => /\.woff2(\?|#|$)/i.test(u)) ||
        urls.find((u) => /\.woff(\?|#|$)/i.test(u)) ||
        urls[0];

      try {
        return { url: new URL(best, targetUrl).href, family: regular.family };
      } catch { /* fall through */ }
    }

    const slug = key.replace(/\s+/g, "");
    const sorted = [...seenFontUrls].sort((a, b) => {
      const scoreA = a.includes(".woff2") ? 2 : a.includes(".woff") ? 1 : 0;
      const scoreB = b.includes(".woff2") ? 2 : b.includes(".woff") ? 1 : 0;
      return scoreB - scoreA;
    });

    const match = sorted.find((u) =>
      u.toLowerCase().replace(/[^a-z0-9]/g, "").includes(slug)
    );

    if (match) return { url: match, family };
    return null;
  }

  async function download(info) {
    if (!info) return null;
    try {
      const resp = await context.request.get(info.url);
      return {
        family: info.family,
        url: info.url,
        buffer: await resp.body(),
      };
    } catch {
      return null;
    }
  }

  let headerFont = await download(pickUrl(headerFamily));
  let bodyFont = await download(pickUrl(bodyFamily));

  if (!headerFont && bodyFont) headerFont = { ...bodyFont };
  if (!bodyFont && headerFont) bodyFont = { ...headerFont };

  // ── COLOURS ────────────────────────────────────────────
  const colorScheme = await page.evaluate(() => {
    function rgbToHex(r, g, b) {
      return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
    }

    function parseColor(raw) {
      if (!raw || raw === "transparent" || raw === "initial" || raw === "inherit") return null;
      const rgba = raw.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
      if (!rgba) return null;
      const [, r, g, b, a] = rgba;
      if (a !== undefined && parseFloat(a) < 0.1) return null;
      return { hex: rgbToHex(+r, +g, +b), r: +r, g: +g, b: +b, a: a !== undefined ? parseFloat(a) : 1 };
    }

    function isNearWhite(c) { return c && c.r > 240 && c.g > 240 && c.b > 240; }
    function isNearBlack(c) { return c && c.r < 30 && c.g < 30 && c.b < 30; }
    function isGrey(c) { return c && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 15; }
    function isChromatic(c) { return c && !isNearWhite(c) && !isNearBlack(c) && !isGrey(c); }

    const cssVarColors = {};
    const colorKeywords = [
      "primary", "secondary", "accent", "brand", "highlight", "cta",
      "link", "bg", "background", "surface", "text", "foreground",
      "heading", "body", "muted", "border", "error", "success", "warning",
    ];

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule.selectorText !== ":root" && rule.selectorText !== "html") continue;
          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style[i];
            if (!prop.startsWith("--")) continue;
            const val = rule.style.getPropertyValue(prop).trim();
            const parsed = parseColor((() => {
              const el = document.createElement("div");
              el.style.color = val;
              document.body.appendChild(el);
              const resolved = getComputedStyle(el).color;
              document.body.removeChild(el);
              return resolved;
            })());
            if (parsed) {
              const lower = prop.toLowerCase();
              for (const kw of colorKeywords) {
                if (lower.includes(kw)) {
                  cssVarColors[kw] = cssVarColors[kw] || [];
                  cssVarColors[kw].push(parsed.hex);
                }
              }
            }
          }
        }
      } catch { /* cross‑origin */ }
    }

    const bgCounts = {}, textCounts = {};
    const linkColors = [], buttonColors = [], headingColors = [];
    const all = document.querySelectorAll("*");
    const step = Math.max(1, Math.floor(all.length / 800));

    for (let i = 0; i < all.length; i += step) {
      const el = all[i];
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const cs = getComputedStyle(el);
      const bg = parseColor(cs.backgroundColor);
      if (bg) bgCounts[bg.hex] = (bgCounts[bg.hex] || 0) + 1;
      const fg = parseColor(cs.color);
      if (fg) textCounts[fg.hex] = (textCounts[fg.hex] || 0) + 1;
      const tag = el.tagName.toLowerCase();
      if (tag === "a" && fg && isChromatic(fg)) linkColors.push(fg.hex);
      if (tag === "button" || el.getAttribute("role") === "button" ||
        (tag === "a" && (el.className || "").toString().toLowerCase().match(/btn|button|cta/))) {
        if (bg && isChromatic(bg)) buttonColors.push(bg.hex);
        if (fg && isChromatic(fg)) buttonColors.push(fg.hex);
      }
      if (/^h[1-6]$/.test(tag) && fg) headingColors.push(fg.hex);
    }

    function topN(obj, n = 5) {
      return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([hex]) => hex);
    }
    function mostFrequent(arr) {
      const counts = {};
      arr.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
    }

    const allBg = topN(bgCounts, 10);
    const allText = topN(textCounts, 10);
    const background = allBg[0] || "#ffffff";
    const text = allText[0] || "#000000";
    const heading = mostFrequent(headingColors)[0] || text;

    const chromaticBg = allBg.filter((h) => {
      const m = h.match(/^#(..)(..)(..)$/);
      if (!m) return false;
      return isChromatic({ r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) });
    });
    const chromaticText = allText.filter((h) => {
      const m = h.match(/^#(..)(..)(..)$/);
      if (!m) return false;
      return isChromatic({ r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) });
    });

    const primary = mostFrequent(buttonColors)[0] || mostFrequent(linkColors)[0] ||
      (cssVarColors["primary"] || [])[0] || (cssVarColors["brand"] || [])[0] ||
      chromaticBg[0] || chromaticText[0] || "#0066cc";

    const secondary = (cssVarColors["secondary"] || [])[0] ||
      mostFrequent(linkColors).find((c) => c !== primary) ||
      chromaticBg.find((c) => c !== primary) ||
      chromaticText.find((c) => c !== primary) || primary;

    const accent = (cssVarColors["accent"] || [])[0] ||
      (cssVarColors["highlight"] || [])[0] || (cssVarColors["cta"] || [])[0] ||
      mostFrequent(buttonColors).find((c) => c !== primary && c !== secondary) || primary;

    const palette = [...new Set([
      primary, secondary, accent,
      ...mostFrequent(buttonColors), ...mostFrequent(linkColors),
      ...chromaticBg, ...chromaticText,
    ])].slice(0, 10);

    return { background, text, heading, primary, secondary, accent, palette };
  });

  // ── LOGO ───────────────────────────────────────────────
  const domain = new URL(targetUrl).hostname;
  const logo = await fetchTransparentLogo(domain);

  await browser.close();

  return { headerFont, bodyFont, colorScheme, logo };
}

// ── CLI ──────────────────────────────────────────────────
const target = process.argv[2];
if (!target) {
  console.log("Usage: node scrape-design.js <url>");
  process.exit(1);
}

const fs = require("fs");
const { exec } = require("child_process");

scrapeDesignTokens(target)
  .then(({ headerFont, bodyFont, colorScheme, logo }) => {
    // Normalize font names for CSS usage
    const normalizeFontName = (name) => {
      if (!name || name === 'none') return null;
      // If it looks like a Typekit/managed font reference, extract the readable name
      if (name.includes('-w01') || name.includes('-w02')) {
        // Typekit font - try to extract readable name
        const readable = name.split('-')[0].replace(/\d+$/, '').trim();
        return readable || name;
      }
      return name;
    };

    const headerFontNormalized = normalizeFontName(headerFont?.family);
    const bodyFontNormalized = normalizeFontName(bodyFont?.family);

    // Output clean data for API parsing (no decorative characters)
    console.log('RESULT_SUMMARY');
    console.log('Header font:', headerFontNormalized ?? 'none');
    console.log('Body font:', bodyFontNormalized ?? 'none');
    console.log('Background:', colorScheme.background);
    console.log('Text:', colorScheme.text);
    console.log('Heading:', colorScheme.heading);
    console.log('Primary:', colorScheme.primary);
    console.log('Secondary:', colorScheme.secondary);
    console.log('Accent:', colorScheme.accent);
    console.log('Palette:', colorScheme.palette.join(', '));
    console.log('Logo:', logo
      ? `${(logo.buffer.length / 1024).toFixed(1)} KB PNG (transparent)`
      : 'not found');

    // ── open logo in browser ──
    if (logo && !process.env.HEADLESS_MODE) {
      const dataUri = `data:image/png;base64,${logo.buffer.toString("base64")}`;

      const html = `<html>
        <body style="background:#222;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
          <div style="text-align:center">
            <img src="${dataUri}" style="max-width:400px">
            <p style="color:#aaa;font-family:sans-serif;margin-top:20px">
              ${new URL(target).hostname} — transparent logo
            </p>
          </div>
        </body>
      </html>`;

      const tmpFile = process.platform === "win32"
        ? `${process.env.TEMP}\\logo-preview.html`
        : "/tmp/logo-preview.html";

      fs.writeFileSync(tmpFile, html);

      const cmd = process.platform === "darwin"  ? `open ${tmpFile}`
                : process.platform === "win32"   ? `start ${tmpFile}`
                :                                   `xdg-open ${tmpFile}`;

      exec(cmd, (err) => {
        if (err) console.log(`  Open manually: ${tmpFile}`);
      });

      console.log('Opening logo preview in browser...');
    }
  })
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });