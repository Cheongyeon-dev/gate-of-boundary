/**
 * 도감 메인 — 스마트폰 내부 조회 UI (전체 목록 나열 없음)
 */
import { escapeXml, clampLen, foText } from './util.js';
import { getTrendingEntries } from './dex-db.js';

const W = 390;
const PAD = 16;
const INNER = W - PAD * 2;
const UI_REV = '2';
const FONT_KR = "'Noto Sans KR','Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const FONT_MONO = "'D2Coding','NeoDunggeunmo','DungGeunMo',Consolas,monospace";

const GRADE_STYLE = {
  재해: { label: '재해', color: '#ff5544', fill: '#1a0808' },
  '1': { label: '1급', color: '#66ff88', fill: '#001508' },
  '2': { label: '2급', color: '#ffcc33', fill: '#151508' },
  '3': { label: '3급', color: '#ff8833', fill: '#151008' },
  미확인: { label: '—', color: '#888888', fill: '#111111' },
};

const TAG_STYLE = {
  이형: { label: '이형', color: '#cc66ff', fill: '#120818' },
};

const ADMIN_LOG = [
  '[2035.02.08 14:22] BMA-0042 한소 — 교차로 A-7 재목격. Alpha 대기 중.',
  '[2035.02.07 09:10] BMA-0191 호역령 — ○○항 접근 금지 14일 연장.',
  '[2035.02.05 22:40] BMA-0074 참화원귀 — 봉인 상태 점검. 이상 없음.',
  '[2035.02.04 03:15] BMA-0150 역혼령 — 야간 역 폐쇄 유지. 우회 안내.',
];

function fmtViews(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function entryTags(entry) {
  const raw = String(entry.tag || '');
  const out = [];
  if (raw.includes('이형')) out.push('이형');
  return out;
}

function miniChip(x, y, key) {
  const T = TAG_STYLE[key];
  const w = 30;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="16" rx="3" fill="${T.fill}" stroke="${T.color}" stroke-width="0.8"/>
  <text x="${x + w / 2}" y="${y + 12}" font-family="${FONT_MONO}" font-size="8" fill="${T.color}" text-anchor="middle">${T.label}</text>`;
}

function trendingRow(entry, rank, y) {
  const g = ['재해', '1', '2', '3'].includes(entry.grade) ? entry.grade : '미확인';
  const G = GRADE_STYLE[g];
  const tags = entryTags(entry);
  const bg = rank % 2 === 1 ? '#0c100c' : '#090909';
  const gradeW = 34;
  let tagX = PAD + 28 + gradeW + 4;
  const tagMarkup = tags.map((key) => {
    const m = miniChip(tagX, y + 11, key);
    tagX += 34;
    return m;
  }).join('');
  const nameX = tagX + 6;

  return `
  <rect x="${PAD}" y="${y}" width="${INNER}" height="40" rx="6" fill="${bg}" stroke="#1a2a1a" stroke-width="0.8"/>
  <text x="${PAD + 8}" y="${y + 24}" font-family="${FONT_MONO}" font-size="11" fill="#ffaa44" font-weight="bold">${rank}</text>
  <rect x="${PAD + 28}" y="${y + 11}" width="${gradeW}" height="18" rx="4" fill="${G.fill}" stroke="${G.color}" stroke-width="1"/>
  <text x="${PAD + 28 + gradeW / 2}" y="${y + 24}" font-family="${FONT_MONO}" font-size="10" fill="${G.color}" text-anchor="middle" font-weight="bold">${G.label}</text>
  ${tagMarkup}
  ${foText(nameX, y + 5, PAD + INNER - 86 - nameX, 20, clampLen(entry.name, 18), { fontSize: 12, color: '#f0f0f0', fontFamily: FONT_KR, fontWeight: 'bold', maxLen: 18, singleLine: true })}
  ${foText(nameX, y + 22, PAD + INNER - 86 - nameX, 14, entry.id, { fontSize: 8, color: '#5a6a5a', fontFamily: FONT_MONO, maxLen: 12, singleLine: true })}
  <text x="${PAD + INNER - 8}" y="${y + 24}" font-family="${FONT_MONO}" font-size="10" fill="#3dff6a" text-anchor="end">${fmtViews(entry.views)}</text>`;
}

export function buildDexIndexSvg(entries) {
  const trending = getTrendingEntries(entries, 5);
  const green = '#3dff6a';
  const amber = '#ffb300';
  const dim = '#6a8a6a';
  const totalViews = entries.reduce((s, e) => s + e.views, 0);
  const countDisaster = entries.filter((e) => e.grade === '재해').length;
  const countGrade1 = entries.filter((e) => e.grade === '1').length;
  const countSpecial = entries.filter((e) => e.tag).length;

  const H = 548;
  const trendY = 72;
  const trendRows = trending.map((e, i) => trendingRow(e, i + 1, trendY + i * 42)).join('');
  const adminHtml = ADMIN_LOG.map(
    (line) =>
      `<div style="margin:0 0 5px;font-size:9px;line-height:1.35;color:#5ddf7a;word-break:keep-all;overflow-wrap:break-word;">&gt; ${escapeXml(line)}</div>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="phoneBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0c10"/>
      <stop offset="100%" stop-color="#050508"/>
    </linearGradient>
  </defs>

  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="24" fill="#1a1a1a" stroke="#333" stroke-width="2"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="18" fill="url(#phoneBg)" stroke="#2a2a2a"/>

  <text x="${PAD}" y="32" font-family="${FONT_MONO}" font-size="10" fill="#888">15:42</text>
  <text x="${W / 2}" y="32" font-family="${FONT_KR}" font-size="11" fill="#ccc" text-anchor="middle" font-weight="bold">경계관리청 도감</text>
  <text x="${W - PAD}" y="32" font-family="${FONT_MONO}" font-size="9" fill="#555" text-anchor="end">v${UI_REV}</text>

  <text x="${PAD}" y="56" font-family="${FONT_KR}" font-size="13" fill="${amber}" font-weight="bold">최근 조회</text>
  <text x="${W - PAD}" y="56" font-family="${FONT_MONO}" font-size="9" fill="${dim}" text-anchor="end">누적 ${fmtViews(totalViews)}</text>
  ${trendRows}

  <rect x="${PAD}" y="290" width="${INNER}" height="96" rx="8" fill="#0a0a0a" stroke="#2a3a2a"/>
  <rect x="${PAD}" y="290" width="${INNER}" height="24" rx="8" fill="#141414"/>
  <text x="${PAD + 12}" y="306" font-family="${FONT_KR}" font-size="11" fill="#fff" font-weight="bold">도감</text>
  <text x="${PAD + 50}" y="306" font-family="${FONT_KR}" font-size="10" fill="#555">전체</text>
  <text x="${PAD + 84}" y="306" font-family="${FONT_KR}" font-size="10" fill="#555">봉인</text>
  <line x1="${PAD + 42}" y1="296" x2="${PAD + 42}" y2="310" stroke="${green}" stroke-width="2"/>
  <text x="${PAD + 12}" y="328" font-family="${FONT_MONO}" font-size="10" fill="#9aab9a">등록 ${entries.length}건 · 재해 ${countDisaster} · 1급 ${countGrade1} · 이형 ${countSpecial}</text>
  <text x="${PAD + 12}" y="344" font-family="${FONT_KR}" font-size="10" fill="#7a8a7a">상세는 id 조회 · 목록 전체는 미표시</text>
  <text x="${PAD + 12}" y="360" font-family="${FONT_MONO}" font-size="9" fill="#ff6666">재해 등급 / 이형 변이 — 단독 대응 금지 · 상관 보고</text>
  <rect x="${PAD + 12}" y="368" width="40" height="14" rx="3" fill="#1a0808" stroke="#ff5544" stroke-width="0.6"/>
  <text x="${PAD + 32}" y="378" font-family="${FONT_MONO}" font-size="7" fill="#ff7766" text-anchor="middle">재해</text>
  <rect x="${PAD + 58}" y="368" width="40" height="14" rx="3" fill="#120818" stroke="#cc66ff" stroke-width="0.6"/>
  <text x="${PAD + 78}" y="378" font-family="${FONT_MONO}" font-size="7" fill="#cc88ff" text-anchor="middle">이형</text>

  <rect x="${PAD}" y="398" width="${INNER}" height="132" rx="6" fill="#000a04" stroke="#1a3a20"/>
  <text x="${PAD + 10}" y="414" font-family="${FONT_MONO}" font-size="9" fill="${dim}">admin_share.log</text>
  <text x="${PAD + 10}" y="428" font-family="${FONT_KR}" font-size="9" fill="#4a6a4a">현장·관제 공유</text>
  <foreignObject x="${PAD + 8}" y="434" width="${INNER - 16}" height="88">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${FONT_MONO};overflow:hidden;max-height:88px;">${adminHtml}</div>
  </foreignObject>

  <rect x="${W / 2 - 40}" y="${H - 18}" width="80" height="4" rx="2" fill="#444"/>
</svg>`;
}
