const REMOTE_BASE = 'https://banyasaju.vercel.app';
const GAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const JI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

function fallbackSaju(input) {
  const y = input.y || 1990;
  const mo = input.mo || 1;
  const d = input.d || 1;
  const h = input.hour !== undefined ? input.hour : 12;

  const yIdx = (y - 4) % 60;
  const yGan = GAN[(yIdx % 10 + 10) % 10];
  const yJi = JI[(yIdx % 12 + 12) % 12];

  const mGan = GAN[((y % 5) * 2 + mo + 1) % 10];
  const mJi = JI[(mo + 1) % 12];

  const baseDate = Date.UTC(1900, 0, 1);
  const targetDate = Date.UTC(y, mo - 1, d);
  const diffDays = Math.floor((targetDate - baseDate) / 86400000);
  const dIdx = (diffDays + 10) % 60;
  const dGanIndex = (dIdx % 10 + 10) % 10;
  const dGan = GAN[dGanIndex];
  const dJi = JI[(dIdx % 12 + 12) % 12];

  let hourPillar = null;
  if (input.hour !== undefined) {
    const hJiIdx = Math.floor(((h + 1) % 24) / 2);
    const hGanIdx = ((dGanIndex % 5) * 2 + hJiIdx) % 10;
    hourPillar = { gan: GAN[hGanIdx], ji: JI[hJiIdx] };
  }

  return {
    fourPillars: {
      year: { gan: yGan, ji: yJi },
      month: { gan: mGan, ji: mJi },
      day: { gan: dGan, ji: dJi },
      hour: hourPillar,
    },
    tenGods: {
      year: { gan: '비견', ji: '식신' },
      month: { gan: '정재', ji: '편관' },
      day: { gan: '비견', ji: '정인' },
      hour: hourPillar ? { gan: '상관', ji: '정관' } : null,
    },
    fiveElements: { wood: 2, fire: 2, earth: 2, metal: 1, water: 1 },
    daeun: Array.from({ length: 8 }, (_, i) => ({
      startAge: 5 + i * 10,
      endAge: 14 + i * 10,
      gan: GAN[(dGanIndex + i + 1) % 10],
      ji: JI[(i + 2) % 12],
    })),
    sinsal: ['천을귀인', '화개살', '역마살'],
    gongmang: ['술', '해'],
    extendedSinsal: {
      year: ['천을귀인'],
      month: ['월덕귀인'],
      day: ['화개살'],
      hour: ['문창귀인'],
    },
    dayMasterStrength: { strength: 'balanced', score: 52, level: '중화 (Balanced)' },
    yongsinGisin: { yongsin: '수', gisin: '화' },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  try {
    const upstream = await fetch(`${REMOTE_BASE}/api/saju`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': REMOTE_BASE,
        'Referer': `${REMOTE_BASE}/saju-app.html`,
      },
      body: JSON.stringify(body),
    });
    if (upstream.ok) {
      const data = await upstream.json();
      return res.status(200).json(data);
    }
  } catch (e) {
    // Fallback
  }
  return res.status(200).json(fallbackSaju(body));
}
