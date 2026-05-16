/** public/data/dex.json — 도감 DB */

let cache = null;
let loadedAt = 0;
const TTL_MS = 60_000;

export async function loadDexDatabase(env) {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  if (!env?.ASSETS) {
    cache = {};
    return cache;
  }
  try {
    const res = await env.ASSETS.fetch(
      new Request(new URL('/data/dex.json', 'https://assets.local'))
    );
    if (!res.ok) {
      cache = {};
      return cache;
    }
    cache = await res.json();
    loadedAt = Date.now();
    return cache;
  } catch {
    cache = {};
    return cache;
  }
}

export async function getDexEntry(env, id) {
  if (!id || id.startsWith('_')) return null;
  const db = await loadDexDatabase(env);
  const entry = db[id];
  if (!entry || typeof entry !== 'object') return null;
  return entry;
}

/** 위험도 정렬 점수 (낮을수록 상단) */
function dangerScore(entry) {
  const g = entry.grade;
  const tag = String(entry.tag || entry.tags || '');
  let s = 500;
  if (g === '재해') s = 80;
  else if (g === '1') s = 120;
  else if (g === '2') s = 200;
  else if (g === '3') s = 300;
  else if (g === '미확인') s = 400;
  if (tag.includes('이형')) s -= 20;
  return s;
}

const DEFAULT_VIEWS = {
  'BMA-0074': 4218, 'BMA-0150': 3902, 'BMA-0193': 3644, 'BMA-0003': 3105,
  'BMA-0063': 2871, 'BMA-0042': 2650, 'BMA-0191': 2412, 'BMA-0018': 2288,
  'BMA-0190': 2104, 'BMA-0141': 1980, 'BMA-0092': 1855, 'BMA-0001': 1720,
};

function entryViews(id, data) {
  if (data.views != null) return Number(data.views) || 0;
  if (DEFAULT_VIEWS[id]) return DEFAULT_VIEWS[id];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 900;
  return 320 + h;
}

export async function getAllDexEntriesSorted(env) {
  const db = await loadDexDatabase(env);
  const list = Object.entries(db)
    .filter(([key]) => !key.startsWith('_'))
    .map(([id, data]) => ({
      id,
      name: data.name || '—',
      grade: data.grade || '미확인',
      type: data.type || '—',
      tag: data.tag || data.tags || '',
      views: entryViews(id, data),
    }));
  list.sort((a, b) => dangerScore(a) - dangerScore(b) || a.id.localeCompare(b.id));
  return list;
}

export function getTrendingEntries(entries, limit = 5) {
  return [...entries].sort((a, b) => b.views - a.views).slice(0, limit);
}
