/**
 * 괴이·강령체 도감 — 구형 단말 조회 UI
 */
import { WIDTH, escapeXml, estimateLineCount } from './util.js';

const DANGER = {
  재해: { label: '재해', color: '#ff5544' },
  '1': { label: '1급', color: '#66ff88' },
  '2': { label: '2급', color: '#ffcc33' },
  '3': { label: '3급', color: '#ff8833' },
  미확인: { label: '미확인', color: '#888888' },
};

const EXTRA_TAGS = {
  이형: { label: '이형', color: '#cc66ff' },
};

const FONT_KR = "'Noto Sans KR','Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const FONT_MONO = "'D2Coding','NeoDunggeunmo','DungGeunMo',Consolas,monospace";

function parseTags(tagsRaw) {
  if (!tagsRaw) return [];
  return String(tagsRaw)
    .split(/[,·|]/)
    .map((t) => t.trim())
    .filter((t) => EXTRA_TAGS[t]);
}

function collectExtraTags(grade, tagsRaw) {
  const order = ['이형'];
  const parsed = parseTags(tagsRaw);
  return order
    .filter((key) => parsed.includes(key))
    .map((key) => EXTRA_TAGS[key]);
}

function badgeWidth(label) {
  return Math.max(44, label.length * 13 + 18);
}

/** 등급 + 특수 태그를 오른쪽부터 한 줄로 배치 (겹침 방지) */
function buildBadgeRow(grade, tagsRaw, baseY) {
  const g = ['재해', '1', '2', '3'].includes(grade) ? grade : '미확인';
  const D = DANGER[g] ?? DANGER['미확인'];
  const badges = [
    { label: D.label, color: D.color, fill: g === '재해' ? '#1a0808' : '#001a08' },
    ...collectExtraTags(grade, tagsRaw).map((t) => ({
      label: t.label,
      color: t.color,
      fill: '#1a0810',
    })),
  ];

  let x = WIDTH - 24;
  let parts = '';
  for (let i = badges.length - 1; i >= 0; i--) {
    const b = badges[i];
    const w = badgeWidth(b.label);
    x -= w + 8;
    parts =
      `<rect x="${x}" y="${baseY}" width="${w}" height="22" rx="3" fill="${b.fill}" stroke="${b.color}" stroke-width="1.2"/>
  <text x="${x + w / 2}" y="${baseY + 15}" font-family="${FONT_MONO}" font-size="11" fill="${b.color}" text-anchor="middle" font-weight="bold">${escapeXml(b.label)}</text>` +
      parts;
  }
  return parts;
}

function buildWarningBlock(y, isDisaster, hasExtra) {
  if (!isDisaster && !hasExtra) return '';
  const sub = isDisaster && hasExtra
    ? '재해 등급 · 이형 변이 — 단독 대응 금지'
    : isDisaster
      ? '재해 등급 사념체 — 단독 대응 금지'
      : '이형 변이 개체 — 전승 변질 반응';
  return `
  <rect x="24" y="${y}" width="${WIDTH - 48}" height="36" fill="#1a0608" stroke="#ff3333" stroke-width="1.2"/>
  <text x="${WIDTH / 2}" y="${y + 14}" font-family="${FONT_KR}" font-size="11" fill="#ff6666" text-anchor="middle" font-weight="bold">◆ 단독 대응 금지 · 즉시 상관 보고 ◆</text>
  <text x="${WIDTH / 2}" y="${y + 28}" font-family="${FONT_MONO}" font-size="9" fill="#aa4444" text-anchor="middle">${sub}</text>`;
}

export function buildDexSvg(name, grade, type, desc, report, entityId, tagsRaw = '') {
  const extraTags = collectExtraTags(grade, tagsRaw);
  const hasExtra = extraTags.length > 0;
  const isDisaster = grade === '재해';

  const safeName = escapeXml(name || '미등록 개체');
  const safeType = escapeXml(type || '강령체');
  const safeDesc = escapeXml(desc || '—');
  const safeReport = escapeXml(report || '// 보고 기록 없음');
  const safeId = escapeXml(entityId || 'BMA-0000');

  const descLines = estimateLineCount(desc, 28);
  const reportLines = estimateLineCount(report, 52, 14);
  const logH = Math.max(72, Math.min(reportLines, 12) * 15 + 24);
  const warnH = (isDisaster || hasExtra) ? 44 : 0;
  const H = 420 + Math.max(0, descLines - 2) * 18 + logH + warnH;

  const green = '#3dff6a';
  const amber = '#ffb300';
  const dim = '#6a8a6a';
  const panel = '#0d0d0d';
  const border = '#2a2a2a';
  const warnY = H - logH - warnH - 32;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${H}" viewBox="0 0 ${WIDTH} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="scanNoise" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="${green}" opacity="0.3"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${H}" fill="#050505"/>
  <rect x="12" y="8" width="${WIDTH-24}" height="${H-16}" rx="2" fill="${panel}" stroke="${border}" stroke-width="2"/>
  <rect x="12" y="8" width="${WIDTH-24}" height="28" fill="#1a1a1a"/>
  <text x="24" y="27" font-family="${FONT_MONO}" font-size="12" fill="#cccccc">■ 경계관리청_SPIRIT_DB.exe</text>
  <text x="${WIDTH-24}" y="27" font-family="${FONT_MONO}" font-size="11" fill="#666" text-anchor="end">━ □ ×</text>
  <text x="24" y="48" font-family="${FONT_MONO}" font-size="10" fill="${dim}">조회모드 | 강령체·괴이·사념 도감</text>
  <text x="${WIDTH-24}" y="48" font-family="${FONT_MONO}" font-size="10" fill="${green}" text-anchor="end">● ONLINE</text>
  <text x="24" y="78" font-family="${FONT_MONO}" font-size="26" fill="${amber}" font-weight="bold">${safeId}</text>
  ${buildBadgeRow(grade, tagsRaw, 58)}
  <rect x="24" y="88" width="56" height="22" fill="#2a2a2a" stroke="#555"/>
  <text x="52" y="103" font-family="${FONT_KR}" font-size="11" fill="#fff" text-anchor="middle" font-weight="bold">도감</text>
  <text x="100" y="103" font-family="${FONT_KR}" font-size="11" fill="#555" text-anchor="middle">보고</text>
  <rect x="24" y="118" width="${WIDTH-48}" height="96" fill="#001208" stroke="#1a3a20"/>
  <rect x="24" y="118" width="${WIDTH-48}" height="96" fill="url(#scanNoise)" opacity="0.12"/>
  <text x="${WIDTH/2}" y="158" font-family="${FONT_MONO}" font-size="10" fill="${green}" text-anchor="middle" opacity="0.45" letter-spacing="2">[ ENTITY_SCAN ]</text>
  <text x="${WIDTH/2}" y="182" font-family="${FONT_KR}" font-size="17" fill="${green}" text-anchor="middle" font-weight="bold">${safeName}</text>
  <text x="${WIDTH-36}" y="202" font-family="${FONT_MONO}" font-size="9" fill="${dim}" text-anchor="end">entity_scan.bmp</text>
  <rect x="24" y="224" width="${WIDTH-48}" height="${72 + (descLines - 1) * 18}" fill="#0a0a0a" stroke="${border}"/>
  <text x="32" y="242" font-family="${FONT_MONO}" font-size="10" fill="${green}">◆ 분류</text>
  <text x="${WIDTH-32}" y="242" font-family="${FONT_KR}" font-size="12" fill="#e8e8e8" text-anchor="end">${safeType}</text>
  <line x1="32" y1="248" x2="${WIDTH-32}" y2="248" stroke="#222" stroke-dasharray="2,3"/>
  <text x="32" y="266" font-family="${FONT_MONO}" font-size="10" fill="${green}">◆ 개요</text>
  <foreignObject x="32" y="272" width="${WIDTH-64}" height="${descLines * 22}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${FONT_KR};font-size:12px;color:#c8d8c8;line-height:1.55;word-break:keep-all;overflow:hidden;overflow-wrap:break-word;">${safeDesc}</div>
  </foreignObject>
  ${buildWarningBlock(warnY, isDisaster, hasExtra)}
  <rect x="24" y="${H - logH - 28}" width="${WIDTH-48}" height="${logH}" fill="#000a04" stroke="#1a3a20"/>
  <text x="32" y="${H - logH - 14}" font-family="${FONT_MONO}" font-size="10" fill="${dim}">C:\\BOUNDARY\\case.log</text>
  <foreignObject x="32" y="${H - logH - 4}" width="${WIDTH-64}" height="${logH - 16}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${FONT_MONO};font-size:10px;color:${green};line-height:1.5;white-space:pre-wrap;word-break:keep-all;overflow:hidden;overflow-wrap:break-word;">&gt; ${safeReport}</div>
  </foreignObject>
  <text x="24" y="${H-12}" font-family="${FONT_MONO}" font-size="9" fill="${dim}">대한민국 경계관리청 · 내부 조회 전용</text>
</svg>`;
}
