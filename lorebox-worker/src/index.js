/**
 * Lunatalk용 다목적 SVG 렌더러
 */
import {
  WIDTH,
  MAX_TEXT_LEN,
  escapeXml,
  decodeParam,
  fmt,
  estimateLineCount,
  svgResponse,
  arcadeRewardIconMarkup,
  arcadeNpcDollMarkup,
  safeIconId,
  foText,
  clampLen,
} from './util.js';
import { buildDexSvg } from './dex.js';
import { getDexEntry, getAllDexEntriesSorted } from './dex-db.js';
import { buildDexIndexSvg } from './dex-index.js';
import { parseShopItems, buildShopBrowseSvg, buildShopOrderSvg } from './shop.js';

// ── 전투 카드 (combat) ───────────────────────────────────
const COMBAT_W = 600;

function pct(raw, fallback = 0) {
  const n = Number(String(raw ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function seg(x, y, w, h, value, on = '#5eb8ff', off = '#142033') {
  const p = pct(value);
  const fillW = Math.round(w * p / 100);
  const cuts = Array.from({ length: Math.floor(w / 3) }, (_, i) => x + (i + 1) * 3)
    .filter((cx) => cx < x + w)
    .map((cx) => `<rect x="${cx}" y="${y}" width="0.6" height="${h}" fill="#050005" opacity="0.68"/>`)
    .join('');
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${off}" opacity="0.55"/>
  <rect x="${x}" y="${y}" width="${fillW}" height="${h}" fill="${on}" opacity="0.95"/>
  ${cuts}
  <rect x="${x}" y="${y}" width="${w}" height="1" fill="#d8f0ff" opacity="0.25"/>`;
}

function combatMark(action, mark) {
  const m = clampLen(mark || '', 2);
  if (m) return escapeXml(m);
  const a = String(action || '').toLowerCase();
  if (a.includes('seal') || a.includes('봉인')) return '封';
  if (a.includes('purify') || a.includes('정화') || a.includes('제령')) return '淨';
  if (a.includes('call') || a.includes('호명')) return '呼';
  if (a.includes('observe') || a.includes('scan') || a.includes('간파')) return '察';
  if (a.includes('guard') || a.includes('방어')) return '守';
  if (a.includes('attack') || a.includes('퇴치') || a.includes('제압')) return '鎭';
  return '符';
}

function combatText(raw, max = 48) {
  return escapeXml(clampLen(
    decodeParam(raw || '')
      .replace(/부적\s*전개/g, '부적 사용')
      .replace(/원혼집/g, '참화원귀'),
    max
  ));
}

function combatShell(body, h = 214, tone = 'red') {
  const accent = tone === 'blue' ? '#5eb8ff' : tone === 'gold' ? '#d4b87a' : '#ff365e';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${COMBAT_W}" height="${h}" viewBox="0 0 ${COMBAT_W} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="scanC" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="${accent}" opacity="0.14"/>
    </pattern>
    <filter id="softC" x="-10%" y="-18%" width="120%" height="136%">
      <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${accent}" flood-opacity="0.28"/>
    </filter>
    <filter id="textC" x="-6%" y="-20%" width="112%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="${accent}" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="${COMBAT_W}" height="${h}" fill="#030002"/>
  <rect x="8" y="8" width="${COMBAT_W - 16}" height="${h - 16}" rx="3" fill="#100007" stroke="#37202b" stroke-width="2"/>
  <rect x="8" y="8" width="${COMBAT_W - 16}" height="3" fill="#5b0818"/>
  <rect x="8" y="8" width="132" height="3" fill="#e02b4d"/>
  <rect x="140" y="8" width="88" height="3" fill="#d0a24a"/>
  ${body}
</svg>`;
}

function combatEngageSvg(params) {
  const target = combatText(params.get('target') || '미확인 대상', 18);
  const entityId = escapeXml(clampLen(decodeParam(params.get('id') || params.get('targetId') || ''), 12));
  const risk = escapeXml(clampLen(decodeParam(params.get('risk') || params.get('grade') || ''), 14));
  const intro = combatText(params.get('intro') || params.get('log') || '대상이 모습을 드러냈다.', 44);
  const decision = combatText(params.get('decision') || params.get('response') || '대응 판단 대기', 42);
  const turn = escapeXml(clampLen(decodeParam(params.get('turn') || '01'), 4));

  return combatShell(`
  <text x="22" y="28" font-family="Consolas,monospace" font-size="9" fill="#6a7a90" letter-spacing="1">TURN ${turn} / ENGAGE</text>
  <text x="554" y="50" font-family="'Batang',serif" font-size="16" fill="#f0ebe3" text-anchor="end" font-weight="700">${target}</text>
  <text x="554" y="68" font-family="Consolas,monospace" font-size="9" fill="#8a7a82" text-anchor="end">${entityId}${entityId && risk ? ' · ' : ''}${risk}</text>
  <g filter="url(#softC)">
    <rect x="70" y="58" width="340" height="64" fill="#100007" stroke="#241018"/>
    <rect x="70" y="58" width="340" height="64" fill="url(#scanC)" opacity="0.7"/>
    <text x="240" y="94" font-family="'Batang',serif" font-size="15" fill="#f0ebe3" text-anchor="middle" font-weight="700" filter="url(#textC)">${intro}</text>
  </g>
  <rect x="70" y="136" width="456" height="24" fill="#100007" stroke="#241018"/>
  <text x="86" y="152" font-family="'Batang',serif" font-size="11" fill="#ff365e" font-weight="700">권고</text>
  <text x="150" y="152" font-family="'Batang',serif" font-size="11" fill="#d8dee8">${decision}</text>
  `, 174);
}

function combatResolveSvg(params) {
  const target = combatText(params.get('target') || '미확인 대상', 16);
  const goal = escapeXml(clampLen(decodeParam(params.get('goal') || '제령'), 4));
  const progress = pct(params.get('progress'), 0);
  const actor = escapeXml(clampLen(decodeParam(params.get('actor') || '{{user}}'), 14));
  const spirit = pct(params.get('spirit'), 70);
  const erosionRaw = params.get('erosion');
  const showErosion = erosionRaw !== null && erosionRaw !== '';
  const turn = escapeXml(clampLen(decodeParam(params.get('turn') || '02'), 4));
  const action = decodeParam(params.get('action') || '');
  const mark = combatMark(action, decodeParam(params.get('mark') || ''));
  const label = combatText(params.get('label') || action || '판정', 10);
  const verdict = combatText(params.get('verdict') || params.get('log') || '상황이 흔들린다.', 42);
  const tone = decodeParam(params.get('tone') || '');

  return combatShell(`
  <text x="22" y="28" font-family="Consolas,monospace" font-size="9" fill="#6a7a90" letter-spacing="1">TURN ${turn} / RESOLVE</text>
  <text x="554" y="50" font-family="'Batang',serif" font-size="15" fill="#f0ebe3" text-anchor="end" font-weight="700">${target}</text>
  <text x="392" y="70" font-family="'Batang',serif" font-size="10" fill="#b8a47a">${goal}</text>
  ${seg(426, 62, 128, 8, progress, '#ff365e', '#201018')}
  <g filter="url(#softC)">
    <text x="116" y="112" font-family="Georgia,serif" font-size="44" fill="#ff365e" text-anchor="middle">${mark}</text>
    <text x="190" y="94" font-family="'Batang',serif" font-size="15" fill="#d0a24a" font-weight="700">${label}</text>
    <text x="190" y="120" font-family="'Batang',serif" font-size="14" fill="#f0ebe3" filter="url(#textC)">${verdict}</text>
  </g>
  <text x="42" y="164" font-family="'Batang',serif" font-size="13" fill="#f0ebe3" font-weight="700">${actor}</text>
  <text x="42" y="184" font-family="'Batang',serif" font-size="10" fill="#b8a47a">영력</text>
  ${seg(78, 176, 142, 8, spirit, '#ff365e', '#201018')}
  ${showErosion ? `<text x="238" y="184" font-family="'Batang',serif" font-size="10" fill="#b8a47a">자아침식</text>${seg(296, 176, 104, 8, pct(erosionRaw), '#d0a24a', '#24142f')}` : ''}
  `, 214, tone);
}

// ── 기본 대화 박스 (기존) ────────────────────────────────
const BASE_THEME = {
  bgTop: '#0f1a28',
  bgBottom: '#0b1622',
  border: '#3b9eff',
  borderGlow: 'rgba(59,158,255,0.45)',
  nameBg: '#0b1622',
  nameText: '#5eb8ff',
  bodyText: '#f8fafc',
  corner: '#3b9eff',
};

function buildBaseSvg(sender, text) {
  const T = BASE_THEME;
  const PAD_X = 48, PAD_TOP = 52, PAD_BOTTOM = 36;
  const safeSender = escapeXml(sender);
  const safeText = escapeXml(text);
  const lineCount = estimateLineCount(text);
  const contentH = lineCount * 32;
  const totalH = Math.max(160, PAD_TOP + contentH + PAD_BOTTOM);
  const boxH = totalH - 24;
  const npW = Math.min(280, Math.max(140, sender.length * 18 + 48));
  const npX = (WIDTH - npW) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${totalH}" viewBox="0 0 ${WIDTH} ${totalH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${T.bgTop}"/>
      <stop offset="100%" stop-color="${T.bgBottom}"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${T.border}" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect x="8" y="22" width="${WIDTH-16}" height="${boxH}" rx="10" fill="url(#bg)" stroke="${T.border}" stroke-width="1.8" filter="url(#glow)"/>
  <path d="M8 58 L8 22 L44 22" stroke="${T.corner}" stroke-width="2.5" fill="none"/>
  <path d="M${WIDTH-44} 22 L${WIDTH-8} 22 L${WIDTH-8} 58" stroke="${T.corner}" stroke-width="2.5" fill="none"/>
  <path d="M8 ${boxH-14} L8 ${boxH+22} L44 ${boxH+22}" stroke="${T.corner}" stroke-width="2.5" fill="none"/>
  <path d="M${WIDTH-44} ${boxH+22} L${WIDTH-8} ${boxH+22} L${WIDTH-8} ${boxH-14}" stroke="${T.corner}" stroke-width="2.5" fill="none"/>
  <rect x="${npX}" y="6" width="${npW}" height="34" rx="17" fill="${T.nameBg}" stroke="${T.border}" stroke-width="1.5"/>
  <text x="${WIDTH/2}" y="29" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="15" fill="${T.nameText}" text-anchor="middle" font-weight="bold">【 ${safeSender} 】</text>
  <foreignObject x="${PAD_X}" y="${PAD_TOP-8}" width="${WIDTH-PAD_X*2}" height="${contentH+16}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;justify-content:center;align-items:center;width:100%;min-height:100%;margin:0;padding:0;">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;font-size:20px;color:${T.bodyText};text-align:center;line-height:1.55;word-break:keep-all;overflow-wrap:break-word;white-space:pre-wrap;text-shadow:0 0 12px ${T.borderGlow};">${safeText}</div>
    </div>
  </foreignObject>
</svg>`;
}

// ── 인형뽑기 (arcade) ────────────────────────────────────

const GRADE_CONFIG = {
  SS: { color: '#ff4db8', bg: '#2a0a1f', star: '★★★★★', label: 'SS', glow: 'rgba(255,77,184,0.6)' },
  S:  { color: '#ffd700', bg: '#1f1a00', star: '★★★★☆', label: 'S',  glow: 'rgba(255,215,0,0.5)'   },
  A:  { color: '#5ce1ff', bg: '#001f2a', star: '★★★☆☆', label: 'A',  glow: 'rgba(92,225,255,0.45)' },
  B:  { color: '#aaffaa', bg: '#001a00', star: '★★☆☆☆', label: 'B',  glow: 'rgba(170,255,170,0.4)' },
  꽝: { color: '#888888', bg: '#1a1a1a', star: '☆☆☆☆☆', label: '꽝', glow: 'rgba(136,136,136,0.3)' },
};

/** 뽑기 전·방문 시 — 결과 없는 대기 화면 */
function buildArcadeIdleSvg(lcdMsg) {
  const H = 420;
  const machineTop = '#0d1230';
  const machineMid = '#111840';
  const neonPink = '#ff4db8';
  const neonBlue = '#5ce1ff';
  const glassTop = '#1a2a5a';
  const glassBot = '#0a1535';
  const safeMsg = escapeXml(lcdMsg || '동전을 넣어주세요');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${H}" viewBox="0 0 ${WIDTH} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="machBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${machineTop}"/>
      <stop offset="100%" stop-color="${machineMid}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${glassTop}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="${glassBot}" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="glassShine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="white" stop-opacity="0.07"/>
      <stop offset="40%" stop-color="white" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="white" stop-opacity="0.02"/>
    </linearGradient>
    <filter id="neonPink" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${neonPink}" flood-opacity="0.8"/>
    </filter>
    <filter id="neonBlue" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${neonBlue}" flood-opacity="0.7"/>
    </filter>
  </defs>

  <rect x="20" y="0" width="${WIDTH-40}" height="${H}" rx="18" fill="url(#machBody)" stroke="${neonPink}" stroke-width="2.5" filter="url(#neonPink)"/>
  <rect x="20" y="0" width="${WIDTH-40}" height="52" rx="18" fill="${neonPink}" opacity="0.15"/>
  <text x="${WIDTH/2}" y="22" font-family="'Malgun Gothic',sans-serif" font-size="11" fill="${neonBlue}" text-anchor="middle" letter-spacing="4" opacity="0.8">[ CRANE MACHINE ]</text>
  <text x="${WIDTH/2}" y="44" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="17" fill="${neonPink}" text-anchor="middle" font-weight="bold" filter="url(#neonPink)">관리청 골목 · 인형뽑기방</text>

  <!-- 유리창 -->
  <rect x="40" y="62" width="${WIDTH-80}" height="185" rx="8" fill="url(#glass)" stroke="${neonBlue}" stroke-width="1.5"/>
  <rect x="40" y="62" width="${WIDTH-80}" height="185" rx="8" fill="url(#glassShine)"/>

  <!-- 크레인 암 -->
  <line x1="${WIDTH/2}" y1="72" x2="${WIDTH/2}" y2="108" stroke="#8899bb" stroke-width="3" opacity="0.7"/>
  <line x1="${WIDTH/2-28}" y1="108" x2="${WIDTH/2+28}" y2="108" stroke="#8899bb" stroke-width="2.5" opacity="0.7"/>
  <path d="M ${WIDTH/2-20} 108 L ${WIDTH/2-12} 122 L ${WIDTH/2+12} 122 L ${WIDTH/2+20} 108 Z" fill="#667799" opacity="0.55"/>

  <!-- 인형 실루엣 (미정 — 흐릿하게) -->
  <ellipse cx="130" cy="210" rx="36" ry="28" fill="#ff4db8" opacity="0.12"/>
  <ellipse cx="220" cy="218" rx="32" ry="26" fill="#5ce1ff" opacity="0.1"/>
  <ellipse cx="310" cy="205" rx="38" ry="30" fill="#ffd700" opacity="0.11"/>
  <ellipse cx="400" cy="215" rx="34" ry="27" fill="#aaffaa" opacity="0.1"/>
  <ellipse cx="470" cy="208" rx="28" ry="22" fill="#ff4db8" opacity="0.08"/>

  <!-- 대기 안내 -->
  <text x="${WIDTH/2}" y="168" font-family="monospace" font-size="11" fill="${neonBlue}" text-anchor="middle" letter-spacing="3" opacity="0.55">● READY</text>
  <text x="${WIDTH/2}" y="192" font-family="'Malgun Gothic',sans-serif" font-size="14" fill="#8899cc" text-anchor="middle" opacity="0.65">인형이 가득하다</text>
  <text x="${WIDTH/2}" y="218" font-family="'Malgun Gothic',sans-serif" font-size="22" fill="#dde4ff" text-anchor="middle" font-weight="bold" opacity="0.35">???</text>

  <!-- 하단 조작 패널 -->
  <rect x="40" y="258" width="${WIDTH-80}" height="80" rx="6" fill="#080e20" stroke="#1e2a4a" stroke-width="1.2"/>
  <rect x="52" y="268" width="260" height="58" rx="4" fill="#000e06" stroke="#1a3a20" stroke-width="1"/>
  ${foText(58, 272, 248, 14, 'STATUS', { fontSize: 10, color: '#336633', fontFamily: 'Consolas,monospace', maxLen: 12, singleLine: true })}
  ${foText(58, 288, 248, 34, safeMsg, { fontSize: 16, color: '#44ff88', fontWeight: 'bold', maxLen: 36 })}

  <rect x="330" y="268" width="90" height="28" rx="5" fill="#1a0a2e" stroke="${neonPink}" stroke-width="1.5" opacity="0.85"/>
  <text x="375" y="287" font-family="'Malgun Gothic',sans-serif" font-size="12" fill="${neonPink}" text-anchor="middle" opacity="0.9">5만원 투입</text>
  <rect x="430" y="268" width="80" height="28" rx="5" fill="#0a1a2e" stroke="${neonBlue}" stroke-width="1.2" opacity="0.7"/>
  <text x="470" y="287" font-family="'Malgun Gothic',sans-serif" font-size="12" fill="${neonBlue}" text-anchor="middle" opacity="0.7">반환</text>
  <rect x="330" y="304" width="180" height="10" rx="3" fill="#0d0d0d" stroke="#222244" stroke-width="1"/>

  <rect x="20" y="350" width="${WIDTH-40}" height="3" rx="1" fill="${neonPink}" opacity="0.5" filter="url(#neonPink)"/>
  <text x="40" y="374" font-family="monospace" font-size="10" fill="#445566" letter-spacing="1">SS 3%  S 12%  A 35%  B 40%  꽝 10%</text>
  <text x="${WIDTH-40}" y="374" font-family="'Malgun Gothic',monospace" font-size="10" fill="#334455" text-anchor="end">1회 · 5만원</text>
  <circle cx="36" cy="385" r="5" fill="${neonPink}" opacity="0.6" filter="url(#neonPink)"/>
  <circle cx="${WIDTH-36}" cy="385" r="5" fill="${neonBlue}" opacity="0.6" filter="url(#neonBlue)"/>
</svg>`;
}

function buildArcadeSvg(grade, item, desc, cost, customIcon, assetBase, usePng, iconId, sponsor) {
  const G = GRADE_CONFIG[grade] ?? GRADE_CONFIG['꽝'];
  const dollId = safeIconId(iconId);
  const isDollShowcase = Boolean(dollId);
  const cx = WIDTH / 2;
  const iconMarkup = isDollShowcase
    ? arcadeNpcDollMarkup(cx, 136, assetBase, dollId, G.color)
    : arcadeRewardIconMarkup(cx, 150, grade, customIcon, assetBase, usePng);
  const safeItem = item || '???';
  const safeDesc = desc || '';
  const safeCost = cost ? fmt(cost) : '50,000';
  const isSponsor = sponsor === 'npc' || sponsor === '1' || sponsor === 'true';
  const lcdLabel = isSponsor ? 'SPONSOR' : 'AMOUNT';
  const lcdAmount = isSponsor ? '교관 결제 · 0 ₩' : `− ${safeCost} ₩`;
  const isBlank = grade === '꽝';
  const cardX = isDollShowcase ? 56 : 80;
  const cardW = isDollShowcase ? WIDTH - 112 : WIDTH - 160;
  const cardY = isDollShowcase ? 66 : 78;
  const cardH = isDollShowcase ? 178 : 155;
  const cardInnerW = cardW - 16;
  const itemBoxY = isDollShowcase ? 198 : 158;
  const descBoxY = isDollShowcase ? 222 : 184;
  const dollGlowDef = isDollShowcase || (usePng && grade === 'S')
    ? `<filter id="dollPopGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${G.color}" flood-opacity="0.85"/>
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#000000" flood-opacity="0.45"/>
    </filter>`
    : '';

  const H = 420;

  // 머신 본체 색
  const machineTop = '#0d1230';
  const machineMid = '#111840';
  const neonPink = '#ff4db8';
  const neonBlue = '#5ce1ff';
  const glassTop = '#1a2a5a';
  const glassBot = '#0a1535';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${H}" viewBox="0 0 ${WIDTH} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 머신 본체 그라데이션 -->
    <linearGradient id="machBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${machineTop}"/>
      <stop offset="100%" stop-color="${machineMid}"/>
    </linearGradient>
    <!-- 유리창 그라데이션 -->
    <linearGradient id="glass" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${glassTop}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="${glassBot}" stop-opacity="0.98"/>
    </linearGradient>
    <!-- 결과 카드 배경 -->
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${G.bg}"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
    <!-- 네온 핑크 글로우 필터 -->
    <filter id="neonPink" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${neonPink}" flood-opacity="0.8"/>
    </filter>
    <filter id="neonBlue" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${neonBlue}" flood-opacity="0.7"/>
    </filter>
    <filter id="gradeGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${G.color}" flood-opacity="0.7"/>
    </filter>
    <!-- 유리 하이라이트 -->
    <linearGradient id="glassShine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="white" stop-opacity="0.07"/>
      <stop offset="40%" stop-color="white" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="white" stop-opacity="0.02"/>
    </linearGradient>
    ${dollGlowDef}
  </defs>

  <!-- ══ 머신 본체 ══ -->
  <rect x="20" y="0" width="${WIDTH-40}" height="${H}" rx="18" fill="url(#machBody)" stroke="${neonPink}" stroke-width="2.5" filter="url(#neonPink)"/>

  <!-- 상단 타이틀 바 -->
  <rect x="20" y="0" width="${WIDTH-40}" height="52" rx="18" fill="${neonPink}" opacity="0.15"/>
  <rect x="20" y="38" width="${WIDTH-40}" height="14" fill="${neonPink}" opacity="0.08"/>

  <!-- 타이틀 텍스트 -->
  <text x="${WIDTH/2}" y="22" font-family="'Malgun Gothic',sans-serif" font-size="11" fill="${neonBlue}" text-anchor="middle" letter-spacing="4" opacity="0.8">[ CRANE MACHINE ]</text>
  <text x="${WIDTH/2}" y="44" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="17" fill="${neonPink}" text-anchor="middle" font-weight="bold" filter="url(#neonPink)">관리청 골목 · 인형뽑기방</text>

  <!-- ══ 유리창 영역 ══ -->
  <rect x="40" y="62" width="${WIDTH-80}" height="185" rx="8" fill="url(#glass)" stroke="${neonBlue}" stroke-width="1.5" opacity="0.95"/>
  <!-- 유리 반사 하이라이트 -->
  <rect x="40" y="62" width="${WIDTH-80}" height="185" rx="8" fill="url(#glassShine)"/>
  <!-- 유리 좌상단 반사 선 -->
  <line x1="50" y1="70" x2="50" y2="230" stroke="white" stroke-width="1" opacity="0.08"/>
  <line x1="54" y1="66" x2="54" y2="160" stroke="white" stroke-width="0.5" opacity="0.05"/>

  <!-- ══ 결과 카드 (유리창 안) ══ -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="10" fill="url(#cardBg)" stroke="${G.color}" stroke-width="2" filter="url(#gradeGlow)"/>
  ${isDollShowcase ? `<rect x="${cardX + 4}" y="${cardY + 4}" width="${cardW - 8}" height="${cardH - 8}" rx="8" fill="${G.color}" opacity="0.06"/>` : ''}

  <!-- 등급 배지 -->
  <rect x="${cardX + 6}" y="${cardY + 6}" width="54" height="28" rx="6" fill="${G.color}" opacity="0.2" stroke="${G.color}" stroke-width="1.2"/>
  <text x="${cardX + 33}" y="${cardY + 25}" font-family="'Malgun Gothic',monospace" font-size="15" fill="${G.color}" text-anchor="middle" font-weight="bold" filter="url(#gradeGlow)">${escapeXml(G.label)}</text>

  <!-- 별점 -->
  <text x="${cardX + cardW - 12}" y="${cardY + 25}" font-family="monospace" font-size="13" fill="${G.color}" text-anchor="end" opacity="0.9">${G.star}</text>

  <!-- 구분선 -->
  <line x1="${cardX + 6}" y1="${cardY + 38}" x2="${cardX + cardW - 6}" y2="${cardY + 38}" stroke="${G.color}" stroke-width="0.7" opacity="0.4"/>

  <!-- 아이콘 + 아이템명 -->
  ${iconMarkup}
  ${foText(cardX + 8, itemBoxY, cardInnerW, 24, safeItem, { fontSize: isDollShowcase ? 16 : 17, color: '#ffffff', fontWeight: 'bold', align: 'center', maxLen: 24, singleLine: true })}
  ${foText(cardX + 8, descBoxY, cardInnerW, 28, safeDesc, { fontSize: 11, color: '#aaaacc', align: 'center', maxLen: 56 })}

  <!-- 꽝 오버레이 -->
  ${isBlank ? `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="10" fill="#000000" opacity="0.35"/>
  <text x="${cx}" y="${cardY + cardH / 2}" font-family="'Malgun Gothic',sans-serif" font-size="32" fill="#666666" text-anchor="middle" opacity="0.6">— 꽝 —</text>` : ''}

  <!-- ══ 하단 조작 패널 ══ -->
  <rect x="40" y="258" width="${WIDTH-80}" height="80" rx="6" fill="#080e20" stroke="#1e2a4a" stroke-width="1.2"/>

  <!-- 재화 디스플레이 (LCD) — 잔액 미표시, 박스 내 클리핑 -->
  <rect x="52" y="268" width="260" height="58" rx="4" fill="#000e06" stroke="#1a3a20" stroke-width="1"/>
  ${foText(58, 272, 248, 14, lcdLabel, { fontSize: 10, color: isSponsor ? '#665533' : '#336633', fontFamily: 'Consolas,monospace', maxLen: 12, singleLine: true })}
  ${foText(58, 288, 248, 34, lcdAmount, { fontSize: isSponsor ? 15 : 18, color: isSponsor ? '#ffcc66' : '#44ff88', fontWeight: 'bold', fontFamily: "'Malgun Gothic',Consolas,monospace", maxLen: 24, singleLine: true })}

  <!-- 투입 버튼 (장식) -->
  <rect x="330" y="268" width="90" height="28" rx="5" fill="#1a0a2e" stroke="${neonPink}" stroke-width="1.5"/>
  <text x="375" y="287" font-family="'Malgun Gothic',sans-serif" font-size="12" fill="${neonPink}" text-anchor="middle">5만원 투입</text>

  <rect x="430" y="268" width="80" height="28" rx="5" fill="#0a1a2e" stroke="${neonBlue}" stroke-width="1.2"/>
  <text x="470" y="287" font-family="'Malgun Gothic',sans-serif" font-size="12" fill="${neonBlue}" text-anchor="middle">반환</text>

  <!-- 코인슬롯 (장식) -->
  <rect x="330" y="304" width="180" height="10" rx="3" fill="#0d0d0d" stroke="#222244" stroke-width="1"/>
  <text x="420" y="313" font-family="monospace" font-size="8" fill="#333366" text-anchor="middle" letter-spacing="2">COIN SLOT</text>

  <!-- ══ 하단 네온 장식 바 ══ -->
  <rect x="20" y="350" width="${WIDTH-40}" height="3" rx="1" fill="${neonPink}" opacity="0.5" filter="url(#neonPink)"/>

  <!-- 하단 정보 바 -->
  <rect x="20" y="358" width="${WIDTH-40}" height="42" rx="0" fill="#080e1e" opacity="0.9"/>
  <rect x="20" y="392" width="${WIDTH-40}" height="8" rx="8" fill="${machineMid}"/>

  <!-- 확률 표시 -->
  <text x="40" y="374" font-family="monospace" font-size="10" fill="#445566" letter-spacing="1">SS 3%  S 12%  A 35%  B 40%  꽝 10%</text>
  <text x="${WIDTH-40}" y="374" font-family="'Malgun Gothic',monospace" font-size="10" fill="#334455" text-anchor="end">1회 · 5만원</text>

  <!-- 하단 모서리 네온 장식 -->
  <circle cx="36" cy="385" r="5" fill="${neonPink}" opacity="0.6" filter="url(#neonPink)"/>
  <circle cx="${WIDTH-36}" cy="385" r="5" fill="${neonBlue}" opacity="0.6" filter="url(#neonBlue)"/>
</svg>`;
}

// ── 경고·공지 (alert) ────────────────────────────────────

const ALERT_LEVEL = {
  normal: { accent: '#c9a227', border: '#7a5e18', badge: '안내', glow: 'rgba(201,162,39,0.35)' },
  urgent: { accent: '#c41e3a', border: '#8b1538', badge: '긴급', glow: 'rgba(196,30,58,0.45)' },
  danger: { accent: '#ff3d52', border: '#aa1020', badge: '위험', glow: 'rgba(255,61,82,0.55)' },
};

const DANCHEONG = { red: '#c41e3a', blue: '#1e6b7a', gold: '#c9a227' };

function buildAlertSvg(sender, text, level, label) {
  const L = ALERT_LEVEL[level] ?? ALERT_LEVEL.urgent;
  const badge = escapeXml(label || L.badge);
  const safeSender = escapeXml(sender || '경계관리청');
  const safeText = escapeXml(text || '…');
  const lineCount = estimateLineCount(text, 20);
  const PAD_TOP = 88;
  const PAD_BOTTOM = 52;
  const contentH = lineCount * 30;
  const H = Math.max(200, PAD_TOP + contentH + PAD_BOTTOM);
  const boxH = H - 28;
  const npW = Math.min(320, Math.max(160, sender.length * 17 + 56));
  const npX = (WIDTH - npW) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${H}" viewBox="0 0 ${WIDTH} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="alertBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a080c"/>
      <stop offset="100%" stop-color="#0e0406"/>
    </linearGradient>
    <filter id="alertGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${L.accent}" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- 본체 -->
  <rect x="10" y="18" width="${WIDTH-20}" height="${boxH}" rx="6" fill="url(#alertBg)" stroke="${L.border}" stroke-width="2" filter="url(#alertGlow)"/>

  <!-- 단청 상단 띠 -->
  <rect x="10" y="18" width="${WIDTH-20}" height="5" fill="${DANCHEONG.red}"/>
  <rect x="10" y="23" width="${WIDTH-20}" height="3" fill="${DANCHEONG.blue}"/>
  <rect x="10" y="26" width="${WIDTH-20}" height="2" fill="${DANCHEONG.gold}"/>

  <!-- 모서리 L자 (단청 적) -->
  <path d="M10 42 L10 18 L38 18" stroke="${DANCHEONG.red}" stroke-width="2.5" fill="none"/>
  <path d="M${WIDTH-38} 18 L${WIDTH-10} 18 L${WIDTH-10} 42" stroke="${DANCHEONG.red}" stroke-width="2.5" fill="none"/>
  <path d="M10 ${boxH+6} L10 ${boxH+18} L38 ${boxH+18}" stroke="${DANCHEONG.blue}" stroke-width="2" fill="none"/>
  <path d="M${WIDTH-38} ${boxH+18} L${WIDTH-10} ${boxH+18} L${WIDTH-10} ${boxH+6}" stroke="${DANCHEONG.blue}" stroke-width="2" fill="none"/>

  <!-- 기관명 -->
  <text x="${WIDTH/2}" y="48" font-family="'Malgun Gothic',sans-serif" font-size="10" fill="${DANCHEONG.gold}" text-anchor="middle" letter-spacing="3" opacity="0.85">대한민국 경계관리청</text>

  <!-- 발신 이름표 -->
  <rect x="${npX}" y="54" width="${npW}" height="30" rx="4" fill="#120608" stroke="${L.accent}" stroke-width="1.5"/>
  <text x="${WIDTH/2}" y="74" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="14" fill="${L.accent}" text-anchor="middle" font-weight="bold">【 ${safeSender} 】</text>

  <!-- 본문 -->
  <foreignObject x="36" y="${PAD_TOP}" width="${WIDTH-72}" height="${contentH + 12}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;justify-content:center;align-items:center;width:100%;min-height:100%;margin:0;padding:0;">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;font-size:18px;color:#f0ebe3;text-align:center;line-height:1.6;word-break:keep-all;overflow-wrap:break-word;white-space:pre-wrap;text-shadow:0 0 14px ${L.glow};">${safeText}</div>
    </div>
  </foreignObject>

  <!-- 하단 구분선 + 등급 배지 -->
  <line x1="36" y1="${H-36}" x2="${WIDTH-36}" y2="${H-36}" stroke="${DANCHEONG.gold}" stroke-width="0.8" opacity="0.45"/>
  <rect x="${WIDTH/2 - 36}" y="${H-30}" width="72" height="22" rx="4" fill="${L.accent}" opacity="0.15" stroke="${L.accent}" stroke-width="1"/>
  <text x="${WIDTH/2}" y="${H-15}" font-family="'Malgun Gothic',monospace" font-size="12" fill="${L.accent}" text-anchor="middle" font-weight="bold" letter-spacing="2">${badge}</text>
</svg>`;
}

// ── fetch 핸들러 ─────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/data/')) &&
      env.ASSETS
    ) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname !== '/' && url.pathname !== '') {
      return new Response('Not Found', { status: 404 });
    }

    const theme = decodeParam(url.searchParams.get('theme') || '');

    // ── alert 경고·공지 ──
    if (theme === 'alert') {
      const sender = decodeParam(url.searchParams.get('sender') || url.searchParams.get('name') || '경계관리청');
      const text   = decodeParam(url.searchParams.get('text') || '');
      const levelRaw = decodeParam(url.searchParams.get('level') || 'urgent');
      const label  = decodeParam(url.searchParams.get('label') || '');
      const levels = ['normal', 'urgent', 'danger'];
      const level  = levels.includes(levelRaw) ? levelRaw : 'urgent';

      let safeSender = sender.slice(0, 40);
      let safeText   = text.slice(0, MAX_TEXT_LEN) || '…';
      if (!text && !sender) {
        safeText = '사용법: ?theme=alert&sender=교관+OOO&text=지시내용&level=urgent&label=돌발+임무';
      }

      const svg = buildAlertSvg(safeSender, safeText, level, label);
      return svgResponse(svg, false);
    }

    // ── 도감 (dex) ──
    if (theme === 'dex') {
      const mode = decodeParam(url.searchParams.get('mode') || '');
      const id = decodeParam(url.searchParams.get('id') || '').slice(0, 24);

      // 메인 목록 (구경·전체 열람)
      if (mode === 'index' || mode === 'list' || (!id && !mode)) {
        const entries = await getAllDexEntriesSorted(env);
        const svg = buildDexIndexSvg(entries);
        return svgResponse(svg, false);
      }

      let name = decodeParam(url.searchParams.get('name') || '');
      let grade = decodeParam(url.searchParams.get('grade') || '미확인');
      let type = decodeParam(url.searchParams.get('type') || '');
      let desc = decodeParam(url.searchParams.get('desc') || '');
      let report = decodeParam(url.searchParams.get('report') || '');
      let tags = decodeParam(url.searchParams.get('tag') || url.searchParams.get('tags') || '');

      if (id) {
        const entry = await getDexEntry(env, id);
        if (entry) {
          name = entry.name ?? name;
          grade = entry.grade ?? grade;
          type = entry.type ?? type;
          desc = entry.desc ?? desc;
          report = entry.report ?? report;
          tags = entry.tag ?? entry.tags ?? tags;
        } else {
          name = name || '미등록 개체';
          desc = desc || `도감 DB에 ${id} 항목이 없습니다.`;
        }
      }

      const svg = buildDexSvg(
        name.slice(0, 40),
        grade.slice(0, 8),
        type.slice(0, 30),
        desc.slice(0, MAX_TEXT_LEN),
        report.slice(0, 1500),
        id || 'BMA-????',
        tags.slice(0, 40)
      );
      return svgResponse(svg, false);
    }

    // ── 전투 카드 (combat) ──
    if (theme === 'combat') {
      const mode = decodeParam(url.searchParams.get('mode') || 'engage');
      const svg =
        mode === 'resolve' || mode === 'result'
          ? combatResolveSvg(url.searchParams)
          : combatEngageSvg(url.searchParams);
      return svgResponse(svg, false);
    }

    // ── 전용몰 (shop) ──
    if (theme === 'shop') {
      const mode = decodeParam(url.searchParams.get('mode') || '');
      const shopName = decodeParam(url.searchParams.get('shop') || url.searchParams.get('store') || '경계 BASE');
      const tagline = decodeParam(url.searchParams.get('tag') || url.searchParams.get('tagline') || '');
      if (mode === 'order' || mode === 'confirm' || mode === 'done') {
        const item = decodeParam(url.searchParams.get('item') || '');
        const price = decodeParam(url.searchParams.get('price') || '0');
        const orderId = decodeParam(url.searchParams.get('orderId') || url.searchParams.get('oid') || '');
        const eta = decodeParam(url.searchParams.get('eta') || url.searchParams.get('delivery') || '');
        const iconId = safeIconId(
          decodeParam(url.searchParams.get('iconId') || url.searchParams.get('img') || '')
        );
        const svg = buildShopOrderSvg(shopName, tagline, item, price, orderId, eta, url.origin, iconId);
        return svgResponse(svg, false);
      }

      const items = parseShopItems(url.searchParams);
      const svg = buildShopBrowseSvg(shopName, tagline, items, url.origin);
      return svgResponse(svg, false);
    }

    // ── arcade 테마 ──
    if (theme === 'arcade') {
      const mode  = decodeParam(url.searchParams.get('mode') || '');
      const grade = decodeParam(url.searchParams.get('grade') || '');
      const item  = decodeParam(url.searchParams.get('item')  || '');
      const desc  = decodeParam(url.searchParams.get('desc')  || '');
      const cost  = decodeParam(url.searchParams.get('cost')  || '50000');
      const msg   = decodeParam(url.searchParams.get('msg') || '동전을 넣어주세요');

      // 대기 화면: mode=idle | grade·item 없음
      const isIdle =
        mode === 'idle' ||
        mode === 'ready' ||
        (!grade && !item && mode !== 'result');

      if (isIdle) {
        return svgResponse(buildArcadeIdleSvg(msg), false);
      }

      const validGrades = ['SS', 'S', 'A', 'B', '꽝'];
      const safeGrade = validGrades.includes(grade) ? grade : '꽝';
      const customIcon = decodeParam(url.searchParams.get('icon') || '').slice(0, 8);
      const usePng = decodeParam(url.searchParams.get('png') || '') === '1';
      const iconIdRaw =
        url.searchParams.get('iconId') ||
        url.searchParams.get('npc') ||
        url.searchParams.get('icon_id') ||
        '';
      const iconId = safeIconId(decodeParam(iconIdRaw));
      const payer = decodeParam(url.searchParams.get('payer') || url.searchParams.get('sponsor') || '');
      const svg = buildArcadeSvg(
        safeGrade,
        clampLen(item, 40),
        clampLen(desc, 80),
        cost,
        customIcon || null,
        url.origin,
        usePng,
        iconId,
        payer
      );
      return svgResponse(svg, false);
    }

    // ── 기본 대화 박스 ──
    const senderRaw = url.searchParams.get('sender') || url.searchParams.get('name') || '';
    const textRaw   = url.searchParams.get('text') || '';

    if (!senderRaw && !textRaw) {
      return svgResponse(
        buildBaseSvg(
          '안내',
          '경고: ?theme=alert | 도감: ?theme=dex&mode=index | 뽑기: ?theme=arcade&mode=idle | 몰: ?theme=shop&item1~8&menu='
        ),
        false
      );
    }

    let sender = decodeParam(senderRaw) || '안내';
    let text   = decodeParam(textRaw)   || '…';
    if (sender.length > 40) sender = sender.slice(0, 40);
    if (text.length > MAX_TEXT_LEN) text = text.slice(0, MAX_TEXT_LEN) + '…';

    return svgResponse(buildBaseSvg(sender, text), false);
  },
};

