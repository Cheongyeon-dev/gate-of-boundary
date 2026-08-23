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
  htmlResponse,
  arcadeRewardIconMarkup,
  arcadeNpcDollMarkup,
  safeIconId,
  foText,
  clampLen,
} from './util.js';
import { buildDexSvg } from './dex.js';
import { getDexEntry, getAllDexEntriesSorted } from './dex-db.js';
import { buildDexIndexSvg } from './dex-index.js';
import { mergeCombatParams, normalizeResolveLabel } from './combat-merge.js';
import { parseShopItems, buildShopBrowseSvg, buildShopOrderSvg } from './shop.js';
import { buildTarotSpreadSvg } from './tarot.js';
import { buildBlackjackHandSvg } from './blackjack.js';
import { buildPokerHandSvg } from './poker.js';
import { buildChessBoardSvg } from './chess.js';
import { buildCruiseClueSvg } from './cruise-clue.js';
import { buildCruiseEndingSvg } from './cruise-ending.js';
import { buildCruiseDiceSvg } from './cruise-dice.js';

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
  if (a.includes('bind') || a.includes('결박')) return '縛';
  if (a.includes('guard') || a.includes('방어')) return '守';
  if (a.includes('attack') || a.includes('퇴치') || a.includes('진압')) return '鎭';
  return '符';
}

function combatText(raw, max = 48) {
  return escapeXml(clampLen(
    decodeParam(raw || '')
      .replace(/_/g, ' ')
      .replace(/부적\s*전개/g, '부적 사용')
      .replace(/원혼집/g, '참화원귀'),
    max
  ));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function combatTextMarkup(raw, max = 48, emphasisRaw = '') {
  let safe = combatText(raw, max);
  const tokens = decodeParam(emphasisRaw || '')
    .split(/[|,]/)
    .map((token) => escapeXml(clampLen(token.trim(), 16)))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const token of tokens) {
    safe = safe.replace(
      new RegExp(escapeRegExp(token), 'g'),
      `<span style="color:#ff4d67;text-shadow:0 0 6px rgba(255,77,103,0.58),0 0 14px rgba(100,0,18,0.72);">${token}</span>`
    );
  }

  return safe;
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
  const target = combatText(params.get('target') || params.get('name') || '미확인 대상', 18);
  const entityId = escapeXml(clampLen(decodeParam(params.get('id') || params.get('targetId') || ''), 12));
  const risk = escapeXml(clampLen(decodeParam(params.get('risk') || params.get('grade') || ''), 14));
  const intro = combatTextMarkup(
    params.get('intro') || params.get('log') || '대상이 모습을 드러냈다.',
    54,
    params.get('em') || params.get('emphasis') || ''
  );
  const decision = combatText(params.get('decision') || params.get('response') || '대응 판단 대기', 42);
  const turn = escapeXml(clampLen(decodeParam(params.get('turn') || '01'), 4));

  return combatShell(`
  <text x="22" y="28" font-family="Consolas,monospace" font-size="9" fill="#6a7a90" letter-spacing="1">TURN ${turn} / ENGAGE</text>
  <text x="554" y="50" font-family="'Batang',serif" font-size="16" fill="#f0ebe3" text-anchor="end" font-weight="700">${target}</text>
  <text x="554" y="68" font-family="Consolas,monospace" font-size="9" fill="#8a7a82" text-anchor="end">${entityId}${entityId && risk ? ' · ' : ''}${risk}</text>
  <g filter="url(#softC)">
    <rect x="58" y="56" width="382" height="68" fill="#100007" stroke="#241018"/>
    <rect x="58" y="56" width="382" height="68" fill="url(#scanC)" opacity="0.7"/>
    <foreignObject x="72" y="64" width="354" height="52">
      <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;margin:0;padding:0 14px;box-sizing:border-box;overflow:hidden;">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;font-family:'Batang','Nanum Myeongjo',serif;font-size:13px;font-weight:700;line-height:1.32;color:#f0ebe3;text-align:left;word-break:keep-all;overflow-wrap:break-word;white-space:pre-wrap;max-width:100%;max-height:100%;overflow:hidden;text-shadow:0 0 8px rgba(255,54,94,0.22);">${intro}</div>
      </div>
    </foreignObject>
  </g>
  <rect x="70" y="136" width="456" height="24" fill="#100007" stroke="#241018"/>
  <text x="86" y="152" font-family="'Batang',serif" font-size="11" fill="#ff365e" font-weight="700">권고</text>
  <foreignObject x="126" y="139" width="386" height="20">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;width:100%;height:100%;margin:0;padding:0;box-sizing:border-box;font-family:'Batang','Nanum Myeongjo',serif;font-size:10px;line-height:1.25;color:#d8dee8;word-break:keep-all;overflow-wrap:break-word;overflow:hidden;">${decision}</div>
  </foreignObject>
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
  const action = decodeParam(params.get('action') || '').replace(/_/g, ' ');
  const mark = combatMark(action, decodeParam(params.get('mark') || ''));
  const label = combatText(
    normalizeResolveLabel(params.get('label'), params.get('action')),
    10
  );
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
    <foreignObject x="190" y="102" width="348" height="34">
      <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;width:100%;height:100%;margin:0;padding:0 8px 0 0;box-sizing:border-box;font-family:'Batang',serif;font-size:12px;font-weight:700;line-height:1.35;color:#f0ebe3;word-break:keep-all;overflow-wrap:break-word;overflow:hidden;text-shadow:0 0 10px rgba(255,54,94,0.22);">${verdict}</div>
    </foreignObject>
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
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;font-size:16px;color:${T.bodyText};text-align:center;line-height:1.5;word-break:keep-all;overflow-wrap:break-word;white-space:pre-wrap;overflow:hidden;text-shadow:0 0 10px ${T.borderGlow};">${safeText}</div>
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
  const safeMsg = lcdMsg || '동전을 넣어주세요';

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
  const lineCount = estimateLineCount(text, 42);
  const PAD_TOP = 78;
  const PAD_BOTTOM = 36;
  const contentH = lineCount * 28;
  const H = Math.max(150, PAD_TOP + contentH + PAD_BOTTOM);
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
  <text x="${WIDTH/2}" y="48" font-family="'Batang','Nanum Myeongjo',serif" font-size="10" fill="${DANCHEONG.gold}" text-anchor="middle" letter-spacing="3" opacity="0.85">대한민국 경계관리청</text>

  <!-- 발신 이름표 -->
  <rect x="${npX}" y="54" width="${npW}" height="27" rx="4" fill="#120608" stroke="${L.accent}" stroke-width="1.5"/>
  <text x="${WIDTH/2}" y="72" font-family="'Batang','Nanum Myeongjo',serif" font-size="13" fill="${L.accent}" text-anchor="middle" font-weight="bold">【 ${safeSender} 】</text>

  <!-- 본문 -->
  <foreignObject x="36" y="${PAD_TOP}" width="${WIDTH-72}" height="${contentH + 8}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;margin:0;padding:0 18px;box-sizing:border-box;overflow:hidden;">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Batang','Nanum Myeongjo',serif;font-size:14px;font-weight:700;color:#f0ebe3;text-align:center;line-height:1.42;word-break:keep-all;overflow-wrap:break-word;white-space:pre-wrap;max-width:100%;max-height:100%;overflow:hidden;text-shadow:0 0 8px ${L.glow};">${safeText}</div>
    </div>
  </foreignObject>

  <!-- 하단 구분선 + 등급 배지 -->
  <line x1="36" y1="${H-36}" x2="${WIDTH-36}" y2="${H-36}" stroke="${DANCHEONG.gold}" stroke-width="0.8" opacity="0.45"/>
  <rect x="${WIDTH/2 - 36}" y="${H-30}" width="72" height="22" rx="4" fill="${L.accent}" opacity="0.15" stroke="${L.accent}" stroke-width="1"/>
  <text x="${WIDTH/2}" y="${H-15}" font-family="'Batang','Nanum Myeongjo',serif" font-size="12" fill="${L.accent}" text-anchor="middle" font-weight="bold" letter-spacing="2">${badge}</text>
</svg>`;
}

const SITE_HOME =
  'https://cheongyeon-dev.github.io/gate-of-boundary/boundary-gate-page/index.html';
const SITE_NSFW =
  'https://cheongyeon-dev.github.io/gate-of-boundary/boundary-gate-page/gallery-nsfw.html';
const SITE_TRAILER =
  'https://cheongyeon-dev.github.io/gate-of-boundary/boundary-gate-page/trailer.html';
const QUEENS_HOME = 'https://cheongyeon-dev.github.io/queens/';
const QUEENS_GALLERY = 'https://cheongyeon-dev.github.io/queens/gallery.html';

function hubStyles() {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #02070a;
      color: #e8f0f2;
      font-family: "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif;
      line-height: 1.6;
    }
    main {
      width: min(520px, 100%);
      padding: 28px 26px;
      border: 1px solid rgba(94, 184, 255, 0.35);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(8, 22, 28, 0.96), rgba(4, 10, 14, 0.98));
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
    }
    h1 { margin: 0 0 8px; font-size: 1.35rem; color: #f5e6c8; }
    p { margin: 0 0 16px; font-size: 0.92rem; color: rgba(232, 240, 242, 0.78); }
    .primary {
      display: inline-block;
      margin-bottom: 20px;
      padding: 10px 14px;
      border-radius: 8px;
      background: linear-gradient(90deg, #7d1d2d, #1b6875);
      color: #fff4dc;
      font-weight: 800;
      text-decoration: none;
    }
    h2 { margin: 0 0 10px; font-size: 0.82rem; letter-spacing: 0.12em; color: #5eb8ff; text-transform: uppercase; }
    ul { margin: 0; padding: 0; list-style: none; }
    li { margin: 0 0 8px; }
    a {
      color: #9fe8ef;
      font-size: 0.88rem;
      word-break: break-all;
    }
    a:hover { color: #d4f7ff; }
    .note { margin-top: 18px; font-size: 0.8rem; color: #8aa0a2; }
    .hub-nav { margin: 0 0 16px; font-size: 0.84rem; }
    .hub-nav a { margin-right: 12px; }
  `;
}

function buildRootHubHtml(origin, hub) {
  const ex = (q) => `${origin}/${q}`;
  const styles = hubStyles();
  const title = '파랑 · SVG API';

  if (!hub) {
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>캐릭터 채팅·홈페이지용 <strong>SVG 이미지 생성</strong> 주소입니다. 세계관별 미리보기를 선택하세요.</p>
    <h2>미리보기 허브</h2>
    <ul>
      <li><a href="${ex('?hub=boundary')}">경계의 문 · theme 미리보기</a></li>
      <li><a href="${ex('?hub=queens')}">퀸즈 · theme 미리보기</a></li>
    </ul>
    <p class="note">theme= 파라미터로 SVG를 직접 호출합니다. 파라미터 없이 루트만 열면 이 안내가 보입니다.</p>
  </main>
</body>
</html>`;
  }

  if (hub === 'queens') {
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · 퀸즈</title>
  <style>${styles}</style>
</head>
<body>
  <main>
    <h1>${title} · 퀸즈</h1>
    <p class="hub-nav"><a href="${ex('?')}">← 허브 목록</a></p>
    <a class="primary" href="${QUEENS_HOME}">퀸즈 홈 (GitHub Pages)</a>
    <h2>theme 미리보기</h2>
    <ul>
      <li><a href="${ex('?theme=blackjack&p1=&pl1=%EB%82%B4%ED%8C%A8&p2=,%3F&pl2=%EC%83%81%EB%8C%80%ED%8C%A8&result=')}">블랙잭 · theme=blackjack</a></li>
      <li><a href="${ex('?theme=poker&board=AH,KS,9D,4C,2H&hole=AD,KD&pot=8600&bet=600&action=%EC%B2%B4%ED%81%AC&deck=28')}">포커 · theme=poker</a></li>
      <li><a href="${ex('?theme=chess&fen=rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR')}">체스 · theme=chess</a></li>
      <li><a href="${ex('?theme=tarot&c1=0&c2=13&c3=17')}">타로 · theme=tarot</a></li>
    </ul>
    <p class="note">채팅·로어북에서는 위 URL을 이미지 링크로 붙여 씁니다.</p>
  </main>
</body>
</html>`;
  }

  if (hub === 'boundary') {
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · 경계의 문</title>
  <style>${styles}</style>
</head>
<body>
  <main>
    <h1>${title} · 경계의 문</h1>
    <p class="hub-nav"><a href="${ex('?')}">← 허브 목록</a></p>
    <a class="primary" href="${SITE_HOME}">경계의 문 홈 (GitHub Pages)</a>
    <h2>theme 미리보기</h2>
    <ul>
      <li><a href="${ex('?theme=alert&sender=%EA%B2%BD%EA%B3%84%EA%B4%80%EB%A6%AC%EC%B2%AD%EC%9E%A5+%EC%B2%AD%EC%97%B0&text=%EB%A7%88%EB%A6%B0%EC%8B%9C%ED%8B%B0+%EA%B2%BD%EA%B3%84+%EB%B6%95%EA%B4%B4&level=urgent&label=%EC%9E%AC%ED%95%B4+%EC%98%88%EB%B9%84&v=1')}">경고창 · theme=alert</a></li>
      <li><a href="${ex('?theme=cruise-clue&id=log_theogony')}">크루즈 단서 · theme=cruise-clue</a></li>
      <li><a href="${ex('?theme=cruise-dice&reason=%EA%B0%91%ED%8C%90+%EC%88%98%EC%83%89&result=14')}">크루즈 다이스 · theme=cruise-dice</a></li>
      <li><a href="${ex('?theme=cruise-ending&title=%EC%8B%AC%EC%97%B0+%EC%86%8D%EC%9C%BC%EB%A1%9C&verdict=%EC%9D%B4%EC%84%B1%EC%9D%84+%EC%9E%83%EA%B3%A0+%EB%B0%94%EB%8B%A4%EC%9D%98+%EC%9D%BC%EB%B6%80%EA%B0%80+%EB%90%98%EB%8B%A4')}">크루즈 엔딩 · theme=cruise-ending</a></li>
      <li><a href="${ex('?theme=dex&id=BMA-0199')}">도감 · theme=dex</a></li>
      <li><a href="${ex('?theme=combat&mode=engage&target=%EC%B0%BD%EA%B7%80&id=BMA-0199&risk=1%EA%B8%89&v=1')}">전투 조우 · theme=combat</a></li>
      <li><a href="${ex('?theme=arcade&mode=idle')}">인형뽑기 대기 · theme=arcade</a></li>
    </ul>
    <p class="note">채팅·로어북에서는 위 URL을 이미지 링크로 붙여 씁니다.</p>
  </main>
</body>
</html>`;
  }

  return buildRootHubHtml(origin, '');
}

// ── RP 이미지 리다이렉트 (/i/ 경계의문 · /q/ 퀸즈 · /c/ 크루즈) ────────
// 경계의문: bi.pharang.workers.dev/i/{캐릭터}/{코드} → `i`/`n` 레포
// 퀸즈:     bi.pharang.workers.dev/q/{캐릭터}/{코드} → `q` 레포 (CA·SH 등 코드 충돌 방지)
// 크루즈:   bi.pharang.workers.dev/c/{캐릭터}/{코드} → `CR` 레포 (캐릭터 RP만)
// 언셒 코드 → GitHub Pages `n` 레포, 그 외 → `i` 레포 (asset-work/NSFW-CODES.md 와 동기화)
const IMAGE_BASE_SAFE = 'https://cheongyeon-dev.github.io/i';
const IMAGE_BASE_NSFW = 'https://cheongyeon-dev.github.io/n';
const IMAGE_BASE_QUEENS = 'https://cheongyeon-dev.github.io/q';
const IMAGE_BASE_CRUISE = 'https://cheongyeon-dev.github.io/CR/temp_cr_repo';

const NSFW_ACTION_CODES = new Set([
  'S01', 'S02', 'S03', 'S04', 'S05', 'S06',
  'DR01', 'DR02', 'DR03', 'DR04', 'DR05',
  'R01', 'R02',
  'T01', 'T02', 'T03',
  'K01',
  'M01', 'M02', 'M03',
  'DD', 'FG',
  'BA01', 'BA02', 'BA03', 'BA04', 'BA05', 'BA06', 'BA07', 'BA08', 'BA09',
  'FB', 'FDR', 'FO', 'FS',
  'WP', 'W1', 'WF',
  'X01', 'X02', 'X03', 'X04', 'X05',
]);

function isNsfwActionCode(actionCode) {
  return NSFW_ACTION_CODES.has(actionCode);
}

// 1차 공개 에셋 기준 캐릭터별/액션별 최대 개수 (`i` 레포)
const IMAGE_COUNTS_SAFE = {"AH":{"0":1,"1":1,"2":3,"3":4,"4":1,"5":1,"6":1,"7":1,"8":3,"9":1,"10":1,"11":1,"12":1,"13":1,"14":1,"15":1,"16":4,"17":1,"BB":5,"WD":5,"A01":1,"A03":1,"A04":4,"B01":1,"C01":1,"C02":1,"C03":1,"D02":1,"E01":3,"E02":1,"F02":4,"F03":2,"F04":4,"G01":1,"G02":2,"G03":1,"G04":2},"BG":{"1":1},"BH":{"0":1,"1":2,"2":2,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":1,"10":1,"11":1,"12":1,"13":2,"14":1,"15":1,"16":1,"17":2,"BB":3,"WD":2,"A01":4,"A03":2,"A04":3,"B01":6,"B03":1,"C02":3,"C03":1,"E01":2,"E02":3,"F02":7,"F04":3,"G01":1,"G02":1,"G03":1,"G04":1},"CA":{"0":1,"1":1,"2":1,"3":1,"4":1,"5":1,"6":7,"7":4,"8":3,"9":6,"10":3,"11":6,"12":4,"13":1,"14":3,"15":4,"16":2,"17":1,"19":1,"20":5,"BB":7,"WD":7,"A01":7,"A03":2,"A04":4,"B01":6,"C01":1,"C02":4,"C03":3,"D02":3,"D03":1,"E01":5,"E02":12,"F01":1,"F02":9,"F04":7,"G01":5,"G02":1,"G03":2,"G04":1},"CR":{"0":1,"1":3,"2":3,"3":1,"4":2,"5":4,"6":2,"7":3,"8":4,"9":2,"10":4,"11":2,"12":2,"13":2,"14":3,"15":2,"16":1,"17":3,"BB":2,"WD":5,"A01":6,"A03":3,"A04":3,"B01":2,"C02":3,"E01":4,"E02":3,"F04":4,"G01":8,"G02":2,"G03":1,"G04":3},"CY":{"0":1,"1":3,"2":4,"3":3,"4":2,"5":3,"6":5,"7":5,"8":5,"9":5,"10":9,"11":4,"12":4,"13":2,"14":5,"15":2,"16":4,"17":2,"20":2,"BB":6,"WD":5,"A01":6,"A03":8,"A04":5,"B01":6,"B02":2,"C02":4,"C03":1,"D01":1,"D02":1,"D04":2,"E01":9,"E02":3,"F02":12,"F03":1,"F04":8,"G01":3,"G02":4,"G03":2,"G04":1},"HL":{"0":1,"1":6,"2":7,"3":4,"4":6,"5":7,"6":3,"7":4,"8":2,"9":3,"10":6,"11":2,"12":3,"13":3,"14":2,"15":1,"16":3,"17":2,"20":1,"BB":3,"WD":9,"A01":5,"A03":7,"A04":5,"B01":8,"B03":3,"C01":2,"C02":2,"D02":2,"E01":7,"E02":6,"F02":3,"F04":2,"G01":3,"G02":2,"G03":1,"G04":6},"HN":{"0":1,"1":2,"2":4,"3":6,"4":3,"5":3,"6":2,"7":3,"8":6,"9":5,"10":6,"11":3,"12":3,"13":2,"14":3,"15":2,"16":3,"17":1,"BB":3,"WD":3,"A01":3,"A03":5,"A04":2,"B01":3,"C02":3,"E01":5,"E02":1,"F04":4,"G01":1,"G02":2,"G03":3,"G04":3},"HR":{"0":1,"1":1,"2":1,"3":1,"4":1,"5":1,"6":1,"7":2,"8":1,"9":1,"10":4,"11":1,"12":1,"13":1,"14":2,"15":1,"16":3,"17":1,"BB":5,"WD":4,"A01":2,"A03":3,"A04":6,"B01":3,"B03":3,"C02":3,"C03":2,"D02":1,"E01":7,"E02":1,"F02":6,"F04":4,"G01":1,"G02":1,"G03":1,"G04":2},"HY":{"0":1,"1":1,"2":3,"3":3,"4":4,"5":3,"6":2,"7":2,"8":2,"9":6,"10":1,"11":2,"12":3,"13":1,"14":2,"15":1,"16":1,"17":2,"BB":2,"WD":3,"A01":7,"A03":2,"A04":2,"B01":3,"C02":3,"E01":3,"E02":2,"F04":2,"G01":3,"G02":1,"G03":1,"G04":2},"IH":{"0":1,"1":2,"2":4,"3":3,"4":3,"5":3,"6":2,"7":3,"8":3,"9":4,"10":6,"11":3,"12":2,"13":3,"14":7,"15":3,"16":3,"17":8,"BB":3,"WD":3,"A01":6,"A03":5,"A04":5,"B01":8,"C02":4,"E01":5,"E02":5,"F04":4,"G01":2,"G02":2,"G03":2,"G04":2},"JW":{"0":1,"1":1,"2":1,"3":3,"4":1,"5":2,"6":1,"7":1,"8":2,"9":1,"10":1,"11":1,"12":1,"13":1,"14":1,"15":1,"16":2,"17":1,"BB":6,"WD":5,"A01":1,"A02":1,"A03":2,"A04":10,"B01":1,"B03":1,"C01":1,"C02":1,"C03":2,"D02":1,"D03":1,"E01":1,"E02":1,"F02":4,"F04":5,"G01":2,"G02":1,"G03":1,"G04":2},"RA":{"0":1,"1":5,"2":6,"3":5,"4":2,"5":5,"6":1,"7":2,"8":4,"9":3,"10":9,"11":2,"12":5,"13":1,"14":4,"15":1,"16":3,"17":5,"A01":6,"A03":5,"A04":4,"B01":4,"BB":4,"C02":5,"E01":5,"E02":7,"F04":6,"G01":6,"G02":3,"G03":4,"G04":1,"WD":5},"RY":{"0":1,"1":4,"2":4,"3":3,"4":4,"5":4,"6":3,"7":1,"8":3,"9":5,"10":4,"11":2,"12":4,"13":3,"14":3,"15":3,"16":3,"17":1,"20":1,"BB":5,"WD":10,"A01":5,"A03":4,"A04":5,"B01":3,"C01":1,"C02":3,"C03":4,"D02":2,"E01":2,"E02":3,"F02":3,"F04":1,"G01":3,"G02":3,"G03":1,"G04":4},"SH":{"0":1,"1":5,"2":3,"3":6,"4":3,"5":3,"6":4,"7":4,"8":4,"9":4,"10":2,"11":3,"12":6,"13":1,"14":8,"15":3,"16":4,"17":6,"20":2,"BB":9,"WD":5,"A01":8,"A02":1,"A03":3,"A04":10,"B01":4,"B03":1,"C01":2,"C02":3,"C03":4,"D02":2,"D03":2,"D04":1,"E01":3,"E02":3,"F01":1,"F02":6,"F03":2,"F04":5,"G01":3,"G02":2,"G03":1,"G04":2},"SI":{"0":1,"1":1,"2":3,"3":7,"4":1,"5":4,"6":3,"7":4,"8":2,"9":2,"10":4,"11":2,"12":2,"13":3,"14":7,"15":1,"16":3,"17":3,"BB":3,"WD":2,"A01":4,"A03":3,"A04":4,"B01":3,"C02":3,"E01":5,"E02":4,"F04":7,"G01":4,"G02":2,"G03":2,"G04":3},"YE":{"0":1,"1":2,"2":4,"3":1,"4":1,"5":6,"6":2,"7":5,"8":2,"9":3,"10":6,"11":3,"12":2,"13":1,"14":2,"15":1,"16":3,"17":1,"BB":3,"WD":4,"A01":4,"A03":3,"A04":3,"B01":6,"C02":1,"E01":2,"E02":2,"F04":2,"G01":2,"G02":3,"G03":1,"G04":1},"YH":{"0":1,"1":2,"2":1,"3":1,"4":1,"5":1,"6":2,"7":1,"8":2,"9":4,"10":4,"11":4,"12":1,"13":1,"14":4,"15":3,"16":3,"17":5,"BB":8,"WD":5,"A01":1,"A02":4,"A03":3,"A04":7,"B01":2,"B02":1,"B03":2,"C02":1,"C03":1,"D02":1,"E01":5,"E02":4,"F02":6,"F04":4,"G01":1,"G02":1,"G03":2,"G04":1},"YN":{"0":1,"1":2,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":2,"10":1,"11":1,"12":2,"13":1,"14":4,"15":1,"16":6,"17":2,"19":1,"BB":3,"WD":2,"A01":1,"A03":1,"A04":3,"B01":3,"B02":2,"C01":1,"C02":1,"C03":1,"E01":2,"E02":2,"F01":1,"F02":3,"F04":3,"G01":2,"G02":2,"G03":2,"G04":1}};

// `n` 레포 — 언셒 에셋 push 후 countsN 에 등록 (미등록 시 max=1)
const IMAGE_COUNTS_NSFW = {"AH":{"DD":5,"FG":5,"S01":6,"S02":5,"S03":4,"S05":3,"S06":3,"T01":2,"T02":3,"T03":4,"X01":6,"X02":6,"X03":5,"X04":6,"X05":3,"BA01":9,"BA02":3,"BA03":2,"BA04":6,"BA05":6,"BA06":2,"BA07":1,"DR01":5,"DR02":2,"DR03":2,"DR04":1,"DR05":5},"BH":{"DR02":1},"CA":{"DD":6,"FG":5,"FO":9,"FS":14,"FDR":12,"M01":1,"S01":12,"S02":7,"S03":8,"S05":6,"S06":3,"T01":3,"T02":5,"T03":4,"X01":5,"X02":5,"X03":7,"X04":2,"X05":5,"BA01":4,"BA02":2,"BA03":5,"BA04":20,"BA05":2,"BA06":3,"BA07":7,"DR01":9,"DR02":3,"DR03":3,"DR04":2,"DR05":13},"CR":{"S05":3,"S06":4},"CY":{"DD":3,"FG":8,"FO":10,"FS":11,"FDR":15,"S01":18,"S02":5,"S03":6,"S05":3,"S06":5,"T01":1,"T02":5,"T03":4,"X01":4,"X02":3,"X03":5,"X04":4,"X05":3,"BA01":3,"BA02":5,"BA03":3,"BA04":4,"BA05":2,"BA06":7,"BA07":6,"DR01":13,"DR02":3,"DR03":3,"DR04":3,"DR05":11},"HL":{"DD":6,"FG":6,"FO":11,"FS":23,"W1":3,"WF":3,"WP":8,"FDR":9,"S01":8,"S02":8,"S03":6,"S05":4,"S06":3,"T01":2,"T02":3,"T03":3,"X01":4,"X02":6,"X03":6,"X04":6,"X05":6,"BA01":8,"BA02":9,"BA03":4,"BA04":7,"BA06":3,"BA07":7,"DR01":3,"DR02":6,"DR03":2,"DR04":1,"DR05":4},"HN":{"FG":5,"FS":1},"HR":{"DD":4,"FG":6,"S01":11,"S02":9,"S03":5,"S05":5,"S06":4,"T01":2,"T02":3,"T03":4,"X01":4,"X02":4,"X03":8,"X04":6,"X05":2,"BA01":9,"BA02":12,"BA03":4,"BA04":5,"BA05":8,"BA06":4,"BA07":4,"DR01":4,"DR02":6,"DR03":3,"DR04":2,"DR05":9},"IH":{"FO":3,"S05":4,"S06":3,"X04":1,"BA01":1,"BA06":1,"BA07":4},"JW":{"DD":4,"FG":5,"S01":11,"S02":3,"S03":2,"S05":4,"S06":7,"T01":2,"T02":3,"T03":4,"X01":5,"X02":5,"X03":8,"X04":4,"X05":3,"BA01":15,"BA02":7,"BA03":3,"BA04":7,"BA05":3,"BA06":3,"BA07":5,"DR01":6,"DR02":2,"DR03":2,"DR04":3,"DR05":2},"RA":{"FG":1,"FS":4},"RY":{"DD":7,"FG":3,"FO":8,"FS":12,"W1":11,"WF":3,"WP":8,"FDR":5,"S01":6,"S02":12,"S03":8,"S05":5,"S06":3,"T01":2,"T02":3,"T03":5,"X01":3,"X02":5,"X03":6,"X04":7,"X05":4,"BA01":19,"BA02":10,"BA03":6,"BA04":13,"BA06":5,"BA07":5,"DR01":3,"DR02":3,"DR03":4,"DR04":3,"DR05":3},"SH":{"DD":7,"FG":6,"FO":8,"FS":6,"FDR":4,"S01":16,"S02":8,"S03":13,"S05":4,"S06":4,"T01":2,"T02":4,"T03":5,"X01":6,"X02":6,"X03":7,"X04":3,"X05":5,"BA01":3,"BA02":5,"BA03":10,"BA04":5,"BA05":2,"BA06":2,"BA07":7,"DR01":16,"DR02":4,"DR03":4,"DR04":3,"DR05":17},"YE":{"BA01":2},"YH":{"DD":6,"FG":13,"FO":4,"FS":8,"FDR":6,"S01":10,"S02":8,"S03":7,"S05":3,"S06":3,"T01":3,"T02":4,"T03":3,"X01":5,"X02":4,"X03":5,"X04":3,"X05":5,"BA01":4,"BA02":3,"BA03":7,"BA04":8,"BA06":4,"BA07":4,"DR01":5,"DR02":5,"DR03":3,"DR04":2,"DR05":11},"YN":{"DR02":2}};

// `q` 레포 — 퀸즈 (성인 only). 경계의문과 코드 겹치면 boundary 우선.
const IMAGE_COUNTS_QUEENS = {"AM":{"0":1,"1":2},"AN":{"0":1,"1":1},"AR":{"0":1,"1":3,"2":3,"3":2,"4":2,"5":3,"6":6,"7":9,"8":10,"9":2,"A01":16,"A02":3,"A03":3,"ALL":4,"BT":4,"C01":10,"CL02":5,"F01":4,"F02":10,"FI":6,"FW":2,"HM":3,"LS01":3,"N01":11,"N02":12,"N03":3,"N04":7,"TA":6},"BE":{"0":1,"1":3,"2":5,"3":3,"4":4,"5":2,"6":3,"7":4,"8":2,"9":5,"AA":15,"ALL":2,"BT":4,"C01":2,"CL02":7,"F01":4,"F02":4,"FI":10,"FW":3,"N01":3,"N02":4,"N03":3,"N04":7},"BK":{"0":1,"1":1,"2":7,"3":3,"4":5,"5":11,"6":2,"7":5,"8":3,"9":5,"A01":1,"A02":1,"A03":2,"ALL":7,"BT":6,"C01":18,"CL02":8,"F01":4,"F02":16,"FG":2,"FI":5,"FW":5,"HM":4,"N01":7,"N02":6,"N03":5,"N04":4,"R":3},"BL":{"0":1,"1":3,"2":2,"3":3,"4":2,"5":2,"6":3,"7":6,"8":3,"9":2,"ALL":6,"BT":4,"C01":7,"CL02":16,"F01":1,"F02":5,"FI":4,"FW":3,"N01":5,"N02":4,"N03":11,"N04":14},"BR":{"0":1,"1":3,"2":3,"3":2,"4":5,"5":7,"6":10,"7":5,"8":3,"9":2,"A01":4,"A02":2,"A03":6,"ALL":2,"BT":4,"C01":2,"CL02":4,"FW":4,"HM":5,"N01":5,"N02":6,"N03":18,"N04":10},"CA":{"0":1,"1":3,"2":6,"3":2,"4":2,"5":3,"6":4,"7":3,"8":1,"9":2,"AA":9,"ALL":3,"BT":2,"C01":2,"CL02":4,"FW":3,"N01":5,"N02":8,"N03":3,"N04":4},"CE":{"0":1,"1":2,"2":4,"3":2,"4":2,"5":2,"6":5,"7":3,"8":4,"9":4,"ALL":1,"BT":3,"C01":1,"CL02":5,"FW":3,"N01":4,"N02":5,"N03":8,"N04":1},"CM":{"0":1,"1":5,"2":2,"3":2,"4":4,"5":2,"6":4,"7":4,"8":8,"9":1,"A01":3,"A02":2,"A03":3,"ALL":2,"BT":7,"C01":1,"CL02":2,"FW":3,"HM":3,"N01":7,"N02":2,"N03":4,"N04":12},"CR":{"0":1,"1":4,"2":3,"3":2,"4":3,"5":2,"6":1,"7":5,"8":2,"9":1,"AA":4,"ALL":9,"BT":5,"C01":4,"CL02":4,"FW":1,"N01":8,"N02":5,"N03":1,"N04":4},"CT":{"0":1,"1":6,"2":3,"3":2,"4":8,"5":3,"6":6,"7":9,"8":5,"9":7,"A01":6,"A02":5,"A03":5,"ALL":4,"BT":5,"C01":2,"CL02":7,"F01":4,"F02":4,"FI":3,"FW":3,"HM":5,"N01":3,"N02":6,"N03":6,"N04":7},"DH":{"0":1,"1":4,"2":3,"3":5,"4":10,"5":2,"6":2,"7":7,"8":4,"9":2,"ALL":4,"BT":6,"C01":2,"CL02":9,"F01":8,"F02":5,"FI":5,"FW":2,"LS01":8,"LS02":4,"N01":3,"N02":6,"N03":10,"N04":26},"EM":{"0":1,"1":5,"2":8,"3":5,"4":4,"5":3,"6":2,"7":4,"8":6,"9":2,"A01":3,"A02":3,"A03":3,"ALL":4,"BT":5,"C01":3,"CL02":4,"FW":4,"HM":2,"N01":4,"N02":4,"N03":4,"N04":3},"GI":{"0":1,"1":8,"2":6,"3":5,"4":6,"5":6,"6":6,"7":6,"8":5,"9":2,"A01":4,"A02":4,"A03":4,"ALL":2,"BT":4,"C01":2,"CL02":3,"FW":1,"HM":3,"N01":2,"N02":4,"N03":19,"N04":7},"HG":{"0":1,"1":1,"A01":1,"A02":1,"A03":1,"HM":2},"HN":{"0":1,"1":1,"9":2,"A01":2,"A02":2,"A03":4,"HM":1},"HO":{"0":1,"1":3,"9":2,"A01":1,"A02":3,"A03":2,"HM":3},"HY":{"0":1,"1":2,"2":2,"3":1,"4":2,"5":3,"6":3,"7":2,"8":4,"9":1,"ALL":3,"BT":7,"C01":4,"CL02":5,"FW":3,"N01":8,"N02":7,"N03":3,"N04":5},"LA":{"0":1,"1":1},"LI":{"0":1,"1":3,"2":3,"3":4,"4":2,"5":3,"6":4,"7":6,"8":6,"9":4,"ALL":4,"BT":3,"C01":4,"CL02":4,"FW":4,"N01":5,"N02":4,"N03":3,"N04":4},"LN":{"0":1,"1":1,"2":2,"3":3,"4":1,"5":2,"6":3,"7":4,"8":6,"9":2,"ALL":2,"BT":8,"C01":1,"CL02":4,"FW":2,"N01":5,"N02":3,"N03":3,"N04":11},"LO":{"0":1,"1":1,"2":2,"3":1,"4":2,"5":2,"6":5,"7":4,"8":5,"9":3,"ALL":2,"BT":3,"C01":2,"CL01":2,"CL02":8,"FW":2,"N01":13,"N02":10,"N03":2,"N04":6},"LU":{"0":1,"1":1},"LX":{"0":1,"1":3,"2":5,"3":4,"4":2,"5":3,"6":4,"7":2,"8":2,"9":1,"ALL":5,"BT":4,"C01":4,"CL01":3,"CL02":6,"FW":3,"N01":9,"N02":5,"N03":13,"N04":7,"TA":2},"MI":{"0":1,"1":5,"2":6,"3":8,"4":8,"5":5,"6":8,"7":8,"8":7,"9":3,"A01":1,"A02":2,"A03":3,"ALL":2,"BT":3,"C01":2,"CL02":3,"FW":4,"HM":2,"N01":6,"N02":3,"N03":4,"N04":4},"MU":{"0":1,"1":4,"2":2,"3":2,"4":2,"5":4,"6":2,"7":2,"8":4,"9":2,"ALL":4,"BT":2,"C01":3,"CL02":7,"FW":4,"N01":2,"N02":6,"N03":2,"N04":2},"MY":{"0":1,"1":1},"NA":{"0":1,"1":2,"2":2,"3":2,"4":2,"5":2,"6":4,"7":3,"8":4,"9":1,"ALL":3,"BT":6,"C01":5,"CL01":3,"CL02":4,"FW":3,"N01":3,"N02":7,"N03":9,"N04":7},"OB":{"0":1,"1":2},"RN":{"0":1,"1":4,"2":2,"3":2,"4":3,"5":3,"6":3,"7":3,"8":2,"9":1,"A01":4,"A02":2,"A03":3,"ALL":2,"BT":4,"C01":2,"CL02":2,"FW":3,"HM":3,"N01":10,"N02":3,"N03":9,"N04":7},"RO":{"0":1,"1":3,"2":1,"3":1,"6":1,"7":1,"9":3,"10":2},"RS":{"0":1,"1":6,"2":3,"3":5,"4":9,"5":1,"6":3,"7":2,"8":3,"9":2,"ALL":1,"BT":4,"C01":4,"CL02":7,"F01":13,"F02":7,"FI":5,"FW":4},"RX":{"0":1,"1":7,"2":2,"3":4,"4":3,"5":2,"6":7,"7":6,"8":9,"9":2,"A01":3,"A02":4,"A03":5,"ALL":4,"BT":5,"C01":10,"CL02":7,"FG":1,"FW":3,"HM":6,"N01":5,"N02":6,"N03":10,"N04":7},"SD":{"0":1,"1":5,"2":4,"3":4,"4":4,"5":4,"6":5,"7":4,"8":6,"9":1,"A01":5,"A02":6,"A03":5,"ALL":2,"BT":4,"C01":1,"CL02":3,"FG":1,"FW":4,"HM":1,"N01":3,"N02":6,"N03":7,"N04":3},"SH":{"0":1,"1":2,"2":2,"3":3,"4":1,"5":2,"6":3,"7":6,"8":1,"9":1,"A01":5,"A02":7,"A03":3,"ALL":5,"BT":4,"C01":3,"CL02":4,"F01":2,"F02":6,"FI":3,"FW":4,"HM":5,"N01":9,"N02":4,"N03":7,"N04":3},"SL":{"0":1,"1":3,"2":2,"3":3,"4":1,"5":2,"6":2,"7":12,"8":6,"9":3,"A01":3,"A02":2,"A03":2,"ALL":4,"BT":6,"C01":5,"CL02":5,"FW":3,"HM":2,"N01":6,"N02":3,"N03":5,"N04":4},"TX":{"0":1,"1":2,"2":2,"3":3,"4":3,"5":3,"6":4,"7":5,"8":4,"9":1,"ALL":1,"BT":3,"C01":2,"CL01":2,"CL02":4,"FW":7,"N01":4,"N02":5,"N03":4,"N04":5},"VA":{"0":1,"1":6,"2":4,"6":1,"9":3,"C01":3},"VC":{"0":1,"1":1},"VI":{"0":1,"1":2,"2":2,"3":3,"4":2,"5":4,"6":2,"7":1,"8":4,"9":3,"AA":3,"ALL":3,"BT":3,"C01":3,"CL02":3,"FW":6,"N01":5,"N02":5,"N03":4,"N04":4},"YS":{"0":1,"1":2,"A01":3,"A02":1,"A03":2,"HM":1},"YU":{"0":1,"1":5,"2":5,"3":6,"4":3,"5":5,"6":1,"7":5,"8":6,"9":3,"A01":4,"A02":3,"A03":4,"ALL":3,"BT":7,"C01":5,"CL02":6,"F01":6,"F02":10,"FI":4,"FW":3,"HM":4,"N01":19,"N02":9,"N03":6,"N04":6}};

// `CR` 레포 — 크루즈. convert 후 counts 갱신 · deploy 필수.
const IMAGE_COUNTS_CRUISE = {
  SL: { 1: 3, 2: 5, 3: 3, 4: 4, 5: 3, 6: 4, 7: 2, A1: 3, A2: 5, A3: 3, A4: 6, A5: 2, A6: 4, B1: 5, B2: 2, B3: 3 },
  KR: { 1: 3, 2: 6, 3: 2, 4: 1, 5: 7, 6: 8, 7: 5, 8: 4, A1: 4, A2: 6, A3: 3, A4: 3, A5: 4, A6: 2, B1: 5, B2: 3, B3: 3 },
  CH: { 1: 2, 2: 5, 3: 5, 4: 6, 5: 10, 6: 7, 7: 12, 8: 4, N: 1, A1: 4, A2: 9, A3: 2, A4: 5, A5: 5, A6: 6, B1: 5, B2: 6, B3: 3 },
  RN: { 1: 4, 2: 3, 3: 3, 4: 10, 5: 5, 6: 5, 7: 3, 8: 7, A1: 4, A2: 6, A3: 3, A4: 5, A5: 6, A6: 3, B1: 3, B2: 3, B3: 2 },
  LZ: { 1: 5, 2: 7, 3: 4, 4: 6, 5: 2, 6: 5, 7: 2, 8: 3, A1: 6, A2: 7, A3: 3, A4: 4, A5: 2, A6: 4, B1: 3, B2: 4, B3: 4 },
  OV: { 1: 2, 2: 5, 3: 4, 4: 2, 5: 3, 6: 8, 7: 4, 8: 4, A1: 6, A2: 7, A3: 4, A4: 7, A5: 5, A6: 5, B1: 2, B2: 4, B3: 2 },
};

// ── fetch 핸들러 ─────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      (url.pathname.startsWith('/icons/') ||
        url.pathname.startsWith('/data/') ||
        url.pathname.startsWith('/assets/')) &&
      env.ASSETS
    ) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === '/gate' || url.pathname === '/gate/') {
      return Response.redirect(SITE_HOME, 302);
    }
    if (url.pathname === '/gate/nsfw' || url.pathname === '/gate/nsfw/') {
      return Response.redirect(SITE_NSFW, 302);
    }
    if (url.pathname === '/gate/trailer' || url.pathname === '/gate/trailer/') {
      return Response.redirect(SITE_TRAILER, 302);
    }
    if (url.pathname === '/queens' || url.pathname === '/queens/') {
      return Response.redirect(QUEENS_HOME, 302);
    }
    if (url.pathname === '/queens/gallery' || url.pathname === '/queens/gallery/') {
      return Response.redirect(QUEENS_GALLERY, 302);
    }

    // ── 퀸즈 RP 이미지 (/q/ → q 레포만) ──
    if (url.pathname.startsWith('/q/')) {
      const qParts = url.pathname.split('/').filter(Boolean);
      if (qParts.length >= 3) {
        const qCharId = qParts[1].toUpperCase();
        let qActionCode = qParts[2].toUpperCase();
        qActionCode = qActionCode.split('-')[0].replace(/\.(?:webp|jpe?g|png)$/i, '');

        if (
          typeof IMAGE_COUNTS_QUEENS !== 'undefined' &&
          IMAGE_COUNTS_QUEENS[qCharId]
        ) {
          const qCounts = IMAGE_COUNTS_QUEENS[qCharId];
          const qMax = qCounts[qActionCode] || 1;
          const qNum = Math.floor(Math.random() * qMax) + 1;
          return Response.redirect(
            `${IMAGE_BASE_QUEENS}/${qCharId}/${qActionCode}-${qNum}.webp`,
            302,
          );
        }
        return new Response('Not Found', { status: 404 });
      }
    }

    // ── 크루즈 RP 이미지 (/c/ → CR 레포) ──
    if (url.pathname.startsWith('/c/')) {
      const cParts = url.pathname.split('/').filter(Boolean);
      if (cParts.length >= 3) {
        const cCharId = cParts[1].toUpperCase();
        let cActionCode = cParts[2].toUpperCase();
        cActionCode = cActionCode.split('-')[0].replace(/\.(?:webp|jpe?g|png)$/i, '');

        if (
          typeof IMAGE_COUNTS_CRUISE !== 'undefined' &&
          IMAGE_COUNTS_CRUISE[cCharId]
        ) {
          const cCounts = IMAGE_COUNTS_CRUISE[cCharId];
          const cMax = cCounts[cActionCode] || 1;
          const cNum = Math.floor(Math.random() * cMax) + 1;
          return Response.redirect(
            `${IMAGE_BASE_CRUISE}/${cCharId}/${cActionCode}-${cNum}.webp`,
            302,
          );
        }
        return new Response('Not Found', { status: 404 });
      }
    }

    // ── 경계의문 RP 이미지 (/i/) ──
    if (url.pathname.startsWith('/i/')) {
      const parts = url.pathname.split('/').filter(Boolean); // ['i', 'CY', 'A01'] | ['i', 'S_comics', '1']
      if (parts.length >= 3) {
        const segment = parts[1];
        const indexRaw = parts[2].split('-')[0].replace(/\.(?:webp|jpe?g|png)$/i, '');

        // DLC 웹툰 — RP와 별도, 고정 번호. 원본 jpg 그대로 GitHub Pages.
        if (segment.toLowerCase() === 's_comics' && /^\d+$/.test(indexRaw)) {
          return Response.redirect(`${IMAGE_BASE_SAFE}/S_comics/${indexRaw}.jpg`, 302);
        }
        if (segment.toLowerCase() === 'comics' && /^\d+$/.test(indexRaw)) {
          return Response.redirect(`${IMAGE_BASE_NSFW}/comics/${indexRaw}.jpg`, 302);
        }

        const charId = segment.toUpperCase();
        let actionCode = parts[2].toUpperCase();
        
        // 만약 AI가 A01-1 처럼 뒤에 번호를 붙여서 호출했다면 제거 (A01만 남김)
        actionCode = actionCode.split('-')[0];

        // 퀸즈 전용 코드 → `q` 레포 (CA·SH 등 경계의문과 겹치면 boundary 우선)
        if (
          typeof IMAGE_COUNTS_QUEENS !== 'undefined' &&
          IMAGE_COUNTS_QUEENS[charId] &&
          !IMAGE_COUNTS_SAFE[charId]
        ) {
          const qCounts = IMAGE_COUNTS_QUEENS[charId];
          const qMax = qCounts[actionCode] || 1;
          const qNum = Math.floor(Math.random() * qMax) + 1;
          return Response.redirect(
            `${IMAGE_BASE_QUEENS}/${charId}/${actionCode}-${qNum}.webp`,
            302,
          );
        }

        const nsfw = isNsfwActionCode(actionCode);
        const counts = nsfw ? IMAGE_COUNTS_NSFW : IMAGE_COUNTS_SAFE;
        const base = nsfw ? IMAGE_BASE_NSFW : IMAGE_BASE_SAFE;

        let max = 1;
        if (counts[charId] && counts[charId][actionCode]) {
          max = counts[charId][actionCode];
        }
        
        // 1부터 max 사이의 랜덤 숫자 생성
        const randomNum = Math.floor(Math.random() * max) + 1;

        // GitHub Pages (`i` 또는 `n`) 로 리다이렉트 (302)
        const redirectUrl = `${base}/${charId}/${actionCode}-${randomNum}.webp`;
        return Response.redirect(redirectUrl, 302);
      }
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

    // ── 크루즈 단서 카드 (ITEM_DB id로 굽기) ──
    if (theme === 'cruise-clue' || theme === 'cruise_clue') {
      const id = decodeParam(url.searchParams.get('id') || '').slice(0, 40);
      const svg = buildCruiseClueSvg(id);
      return svgResponse(svg, true);
    }

    // ── 크루즈 엔딩 카드 (짧은 title·verdict만 URL) ──
    if (theme === 'cruise-ending' || theme === 'cruise_ending') {
      const title = decodeParam(url.searchParams.get('title') || '').slice(0, 48);
      const verdict = decodeParam(
        url.searchParams.get('verdict') || url.searchParams.get('text') || ''
      ).slice(0, 120);
      const svg = buildCruiseEndingSvg({
        title: title || '…',
        verdict: verdict || (title ? '…' : '사용법: ?theme=cruise-ending&title=심연+속으로&verdict=한+줄+결말'),
      });
      return svgResponse(svg, false);
    }

    // ── 크루즈 다이스 표시 카드 (reason·result만 URL) ──
    if (theme === 'cruise-dice' || theme === 'cruise_dice') {
      const reason = decodeParam(
        url.searchParams.get('reason') || url.searchParams.get('diceReason') || ''
      ).slice(0, 40);
      const diceType = decodeParam(url.searchParams.get('type') || url.searchParams.get('diceType') || '1d20').slice(0, 8);
      const resultRaw = decodeParam(url.searchParams.get('result') || url.searchParams.get('diceResult') || '');
      const svg = buildCruiseDiceSvg({ reason, diceType, result: resultRaw });
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
      const merged = await mergeCombatParams(env, url.searchParams, mode);
      const svg =
        mode === 'resolve' || mode === 'result'
          ? combatResolveSvg(merged)
          : combatEngageSvg(merged);
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

    // ── 퀸즈 타로 3장 (tarot) ──
    if (theme === 'tarot') {
      const svg = buildTarotSpreadSvg(url.searchParams);
      return svgResponse(svg, false);
    }

    // ── 퀸즈 블랙잭 핸드 (blackjack) ──
    if (theme === 'blackjack' || theme === 'bj') {
      const svg = buildBlackjackHandSvg(url.searchParams);
      return svgResponse(svg, false);
    }

    // ── 퀸즈 VIP 홀덤 (poker) ──
    if (theme === 'poker') {
      const svg = buildPokerHandSvg(url.searchParams);
      return svgResponse(svg, false);
    }

    // ── RP 체스판 (chess) ──
    if (theme === 'chess') {
      const svg = buildChessBoardSvg(url.searchParams);
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
      const hub = decodeParam(url.searchParams.get('hub') || '');
      return htmlResponse(buildRootHubHtml(url.origin, hub));
    }

    let sender = decodeParam(senderRaw) || '안내';
    let text   = decodeParam(textRaw)   || '…';
    if (sender.length > 40) sender = sender.slice(0, 40);
    if (text.length > MAX_TEXT_LEN) text = text.slice(0, MAX_TEXT_LEN) + '…';

    return svgResponse(buildBaseSvg(sender, text), false);
  },
};

