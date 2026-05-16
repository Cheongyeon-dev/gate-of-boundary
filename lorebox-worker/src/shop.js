/**
 * 상점 v25 — 가로형 스마트폰 HUD 상점
 * 긴 직사각형 정보 박스 / 어두운 면 / 검은 그림자 / 블루 세그먼트
 */
import { escapeXml, fmt, decodeParam, clampLen, safeIconId, foText } from './util.js';

const W = 600;
const H = 360;
const M = 10;
const UI_REV = '25';

const BG = '#020304';
const PANEL = '#07090d';
const PANEL_2 = '#0b0f16';
const SLOT = '#05070b';
const EDGE = '#11151d';
const BLUE = '#4da8ff';
const BLUE_DIM = '#1d3a5c';
const GOLD = '#d4b87a';
const WHITE = '#e8edf5';
const DIM = '#637085';
const DISPLAY = '#dcecff';

const FONT_KO = 'Batang, NanumMyeongjo, AppleMyungjo, YuMincho, serif';
const FONT_EN = 'Consolas, monospace';

function defs() {
  return `
  <defs>
    <linearGradient id="displayG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4fbff"/>
      <stop offset="100%" stop-color="#b9d8f6"/>
    </linearGradient>
    <linearGradient id="titleG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#bfd6f4"/>
    </linearGradient>
    <linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f2dfad"/>
      <stop offset="100%" stop-color="${GOLD}"/>
    </linearGradient>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="${BLUE}" opacity="0.10"/>
    </pattern>
    <filter id="drop" x="-5%" y="-8%" width="110%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.75"/>
    </filter>
    <filter id="blueGlow" x="-8%" y="-14%" width="116%" height="128%">
      <feDropShadow dx="0" dy="0" stdDeviation="2.2" flood-color="${BLUE}" flood-opacity="0.42"/>
    </filter>
  </defs>`;
}

function shell(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs()}
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="${M}" y="6" width="${W - M * 2}" height="${H - 12}" rx="3" fill="${PANEL}" stroke="${EDGE}" stroke-width="2"/>
  <text x="22" y="23" font-family="${FONT_EN}" font-size="7" fill="${DIM}" letter-spacing="1.2">STORE</text>
  <text x="${W - 22}" y="23" font-family="${FONT_EN}" font-size="8" fill="#3a4352" text-anchor="end">━ □ ×</text>
  <rect x="20" y="32" width="${W - 40}" height="1" fill="${BLUE_DIM}"/>
  ${body}
</svg>`;
}

function sealMark(cx, cy, s) {
  const n = s || 22;
  return `<text x="${cx}" y="${cy + 5}" font-family="Georgia, serif" font-size="${Math.round(n * 0.5)}" fill="${GOLD}" text-anchor="middle" opacity="0.9">符</text>`;
}

function thumb(cx, cy, size, iconId, assetBase) {
  const id = safeIconId(iconId);
  const img = size - 6;
  if (id && assetBase) {
    return `<image href="${escapeXml(`${assetBase}/icons/shop/${id}.png`)}" x="${cx - img / 2}" y="${cy - img / 2}" width="${img}" height="${img}" preserveAspectRatio="xMidYMid meet" style="image-rendering:pixelated;image-rendering:crisp-edges"/>`;
  }
  return sealMark(cx, cy, size);
}

function segmentBar(x, y, w, h, ratio) {
  const segW = 3;
  const gap = 1;
  const n = Math.floor(w / (segW + gap));
  const filled = Math.max(0, Math.min(n, Math.round(n * ratio)));
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<rect x="${x + i * (segW + gap)}" y="${y}" width="${segW}" height="${h}" fill="${i < filled ? BLUE : '#142033'}" opacity="${i < filled ? 0.9 : 0.45}"/>`;
  }
  return out;
}

function panelRect(x, y, w, h, inner = '') {
  return `<g filter="url(#drop)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PANEL_2}" stroke="${EDGE}" stroke-width="1"/>${inner}</g>`;
}

function mainDisplay(x, y, w, h, item, assetBase) {
  const name = clampLen(item.name || '—', 12);
  const desc = item.desc ? clampLen(item.desc, 18) : '';
  const price = escapeXml(fmt(item.price || '0'));
  return `
  <g filter="url(#drop)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PANEL_2}" stroke="${EDGE}" stroke-width="1"/>
    <rect x="${x + 12}" y="${y + 16}" width="208" height="${h - 32}" fill="url(#displayG)" opacity="0.94" filter="url(#blueGlow)"/>
    <rect x="${x + 12}" y="${y + 16}" width="208" height="${h - 32}" fill="url(#scan)" opacity="0.25"/>
    <rect x="${x + 234}" y="${y + 16}" width="${w - 250}" height="${h - 32}" fill="${SLOT}" opacity="0.92"/>
    <text x="${x + 338}" y="${y + 38}" font-family="${FONT_EN}" font-size="8" fill="${BLUE}" opacity="0.65" letter-spacing="2" text-anchor="middle">RECOMMENDED</text>
    ${thumb(x + 116, y + h / 2, 74, item.iconId, assetBase)}
    ${foText(x + 252, y + 46, w - 282, 30, name, { fontSize: 18, color: DISPLAY, fontFamily: FONT_KO, fontWeight: '800', maxLen: 16, singleLine: true })}
    ${desc ? foText(x + 252, y + 76, w - 282, 24, desc, { fontSize: 11, color: DIM, fontFamily: FONT_KO, fontWeight: '700', maxLen: 24 }) : ''}
    <rect x="${x + w - 166}" y="${y + h - 42}" width="140" height="28" fill="#020505"/>
    <text x="${x + w - 38}" y="${y + h - 23}" font-family="${FONT_KO}" font-size="15" fill="url(#goldG)" text-anchor="end" font-weight="800">${price}</text>
  </g>`;
}

function previewPanel(x, y, w, h, item, assetBase) {
  const iconId = item.iconId;
  return panelRect(
    x,
    y,
    w,
    h,
    `
    <rect x="${x + 10}" y="${y + 10}" width="122" height="${h - 20}" fill="${SLOT}" stroke="#080b10" stroke-width="1"/>
    <rect x="${x + 10}" y="${y + 10}" width="122" height="${h - 20}" fill="url(#scan)" opacity="0.35"/>
    ${thumb(x + 71, y + h / 2, 54, iconId, assetBase)}
    <text x="${x + 148}" y="${y + 22}" font-family="${FONT_EN}" font-size="8" fill="${BLUE}" opacity="0.75">preview</text>
    ${foText(x + 148, y + 30, w - 164, 24, item.name || '—', { fontSize: 13, color: DISPLAY, fontFamily: FONT_KO, fontWeight: '800', maxLen: 18, singleLine: true })}
    <text x="${x + 148}" y="${y + 64}" font-family="${FONT_EN}" font-size="8" fill="${DIM}">${iconId ? escapeXml(iconId) + '.png' : 'default_seal'}</text>
    `
  );
}

function listLine(x, y, w, item, assetBase) {
  if (!item) return '';
  const name = clampLen(item.name, 14);
  const price = escapeXml(fmt(item.price));
  return `
  <g filter="url(#drop)">
    <rect x="${x}" y="${y - 18}" width="${w}" height="30" fill="${PANEL_2}" stroke="${EDGE}" stroke-width="1"/>
    <rect x="${x + 8}" y="${y - 14}" width="28" height="22" fill="${SLOT}"/>
    ${thumb(x + 22, y - 3, 20, item.iconId, assetBase)}
    ${foText(x + 46, y - 16, 78, 22, name, { fontSize: 12, color: WHITE, fontFamily: FONT_KO, fontWeight: '800', maxLen: 14, singleLine: true })}
    <line x1="${x + 128}" y1="${y - 4}" x2="${x + w - 90}" y2="${y - 4}" stroke="#252525" stroke-dasharray="2,4"/>
    <text x="${x + w - 12}" y="${y}" font-family="${FONT_KO}" font-size="12" fill="url(#goldG)" text-anchor="end" font-weight="800">${price}</text>
  </g>`;
}

export function parseShopItems(params) {
  const items = [];
  for (let i = 1; i <= 8; i++) {
    const name = decodeParam(params.get(`item${i}`) || params.get(`n${i}`) || '');
    const price = decodeParam(params.get(`price${i}`) || params.get(`p${i}`) || '');
    if (!name) continue;
    items.push({
      name: clampLen(name, 24),
      price: price || '0',
      desc: clampLen(decodeParam(params.get(`desc${i}`) || params.get(`d${i}`) || ''), 28),
      iconId: safeIconId(decodeParam(params.get(`iconId${i}`) || params.get(`img${i}`) || '')),
    });
  }
  if (!items.length) {
    const single = decodeParam(params.get('item') || '');
    if (single) {
      items.push({
        name: clampLen(single, 24),
        price: decodeParam(params.get('price') || '0'),
        desc: clampLen(decodeParam(params.get('desc') || ''), 28),
        iconId: safeIconId(decodeParam(params.get('iconId') || params.get('img') || '')),
      });
    }
  }
  return items;
}

export function parseMenuIcons() {
  return [];
}

export function buildShopBrowseSvg(_shopName, _tagline, items, assetBase) {
  const main = items[0] || { name: '—', price: '0', desc: '', iconId: '' };
  const list = items.slice(0, 4);
  const x = 24;
  const w = W - 48;

  return shell(`
  ${mainDisplay(x, 44, w, 136, main, assetBase)}
  <rect x="${x}" y="190" width="${w}" height="1" fill="#151922"/>
  ${previewPanel(x, 202, w, 78, main, assetBase)}
  <text x="${x}" y="300" font-family="${FONT_EN}" font-size="8" fill="${BLUE}" letter-spacing="1">LOADING SUPPLY</text>
  ${segmentBar(x + 112, 293, 280, 8, Math.min(1, Math.max(items.length, 1) / 8))}
  ${listLine(x, 320, w, list[0], assetBase)}
  ${listLine(x, 344, w, list[1], assetBase)}
  <text x="${W / 2}" y="${H - 4}" font-family="${FONT_EN}" font-size="5" fill="#2a3040" text-anchor="middle">${UI_REV}</text>`);
}

export function buildShopOrderSvg(_shopName, _tagline, itemName, price, orderId, eta, assetBase, iconId) {
  const item = { name: itemName || '—', price: price || '0', desc: '', iconId };
  const oid = escapeXml(clampLen(orderId || 'ORD-0000', 12));
  const when = escapeXml(clampLen(eta || '익일', 10));
  return shell(`
  ${mainDisplay(48, 64, W - 96, 112, item, assetBase)}
  <text x="32" y="${H - 12}" font-family="${FONT_EN}" font-size="8" fill="${DIM}">${oid}</text>
  <text x="${W - 32}" y="${H - 12}" font-family="${FONT_KO}" font-size="8" fill="${DIM}" text-anchor="end">${when}</text>`);
}
