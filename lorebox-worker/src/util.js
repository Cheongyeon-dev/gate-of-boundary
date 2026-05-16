export const WIDTH = 600;
export const MAX_TEXT_LEN = 500;

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeParam(raw) {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
  } catch {
    return raw.replace(/\+/g, ' ').trim();
  }
}

export function fmt(num) {
  return Number(String(num).replace(/[^0-9]/g, '')).toLocaleString('ko-KR');
}

/** 표시 길이 제한 (넘치면 …) */
export function clampLen(str, max = 80) {
  const s = String(str ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * foreignObject 텍스트 박스 — SVG 영역 밖 글자 넘침 차단
 */
export function foText(x, y, w, h, text, opts = {}) {
  const {
    fontSize = 12,
    color = '#ffffff',
    fontFamily = "'Malgun Gothic','Apple SD Gothic Neo',sans-serif",
    fontWeight = 'normal',
    align = 'left',
    lineHeight = 1.35,
    maxLen = 120,
    singleLine = false,
  } = opts;
  const safe = escapeXml(clampLen(text, maxLen));
  const justify =
    align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start';
  const whiteSpace = singleLine ? 'nowrap' : 'pre-wrap';

  return `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:${justify};margin:0;padding:2px 4px;">
      <div style="font-family:${fontFamily};font-size:${fontSize}px;color:${color};font-weight:${fontWeight};line-height:${lineHeight};word-break:keep-all;overflow-wrap:break-word;overflow:hidden;text-overflow:ellipsis;white-space:${whiteSpace};max-width:100%;">${safe}</div>
    </div>
  </foreignObject>`;
}

export function estimateLineCount(text, maxCharsPerLine = 22, maxCap = 12) {
  const paragraphs = String(text).split(/\n/);
  let lines = 0;
  for (const para of paragraphs) {
    if (!para.length) { lines += 1; continue; }
    let width = 0;
    for (const ch of para) {
      width += /[^\x00-\xff]/.test(ch) ? 2 : 1;
      if (width >= maxCharsPerLine) { lines += 1; width = 0; }
    }
    if (width > 0) lines += 1;
  }
  return Math.min(Math.max(lines, 1), maxCap);
}

export function gradeIcon(grade) {
  // S·A = 인형 계열 기본 🧸 (종류 달라도 허용)
  const icons = { SS: '🔮', S: '🧸', A: '🧸', B: '📦', 꽝: '💨' };
  return icons[grade] ?? '❓';
}

/** URL용 NPC 아이콘 id (파일명과 동일) */
export function safeIconId(raw) {
  const s = String(raw || '').trim();
  const ok = /^[a-zA-Z0-9_-]{1,32}$/.test(s);
  return ok ? s : '';
}

/** NPC 인형 PNG — 유리창 안 대형 쇼케이스 (약 3배) */
export function arcadeNpcDollMarkup(cx, cy, assetBase, iconId, accentColor) {
  const id = safeIconId(iconId);
  if (!id || !assetBase) return '';
  const size = 156;
  const href = `${assetBase}/icons/npc/${id}.png`;
  const x = cx - size / 2;
  const y = cy - size / 2;
  return `
  <ellipse cx="${cx}" cy="${cy + 6}" rx="${size / 2 + 18}" ry="${size / 2 + 12}" fill="${accentColor}" opacity="0.22"/>
  <ellipse cx="${cx}" cy="${cy + 6}" rx="${size / 2 + 8}" ry="${size / 2 + 5}" fill="#ffffff" opacity="0.07"/>
  <image href="${escapeXml(href)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" filter="url(#dollPopGlow)"/>`;
}

/** iconId 없을 때: 이모지 / 공용 S PNG / 등급 이모지 */
export function arcadeRewardIconMarkup(cx, cy, grade, customIcon, assetBase, usePng) {
  if (customIcon) {
    return `<text x="${cx}" y="${cy}" font-family="'Segoe UI Emoji','Apple Color Emoji',sans-serif" font-size="36" text-anchor="middle">${escapeXml(customIcon)}</text>`;
  }
  if (usePng && grade === 'S' && assetBase) {
    const size = 88;
    const href = `${assetBase}/icons/s-grade.png`;
    return `
  <ellipse cx="${cx}" cy="${cy}" rx="${size / 2 + 10}" ry="${size / 2 + 8}" fill="#ffd700" opacity="0.15"/>
  <image href="${escapeXml(href)}" x="${cx - size / 2}" y="${cy - size / 2 - 4}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" filter="url(#dollPopGlow)"/>`;
  }
  return `<text x="${cx}" y="${cy}" font-family="'Segoe UI Emoji','Apple Color Emoji',sans-serif" font-size="36" text-anchor="middle">${gradeIcon(grade)}</text>`;
}

export function svgResponse(svg, cacheable) {
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': cacheable
        ? 'public, max-age=300'
        : 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
