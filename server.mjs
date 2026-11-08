import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildFreePrompt, buildPaidPrompt, OBJECT_MEANINGS } from './prompts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const REMOTE_BASE = 'https://banyasaju.vercel.app';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
};

// Local fallback Saju calculator in case remote API is unreachable
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

// Call LLM directly using the exact prompts in prompts.mjs if API key is set
async function callDirectLLM(body) {
  const isPaid = body.kind === 'paid';
  const { systemPrompt, userPrompt } = isPaid ? buildPaidPrompt(body) : buildFreePrompt(body);

  const apiUrl = DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
  const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}

// Offline fallback reading matching the exact 7-section structure & persona style from prompts.mjs
function fallbackReading(body) {
  if (body.kind === 'ping') return { ok: true };
  const persona = body.persona || '젊은스님';
  const name = body.meta?.name || '손님';
  const cat = body.meta?.cat || '재물';
  const obj = body.obj || '연꽃';
  const ilju = body.facts?.ilju || '갑자';
  const ilgan = body.facts?.ilgan || '갑(목)';
  const strongList = body.facts?.strongList || '화(3개)';
  const weakList = body.facts?.weakList || '목';
  const yong = body.facts?.yongsin || '수';
  const sinsal = body.facts?.sinsal || '천을귀인, 화개살, 역마살';
  const firstHeading = persona === '스님' ? '【 타고난 사주 】' : '【 타고난 사주 (만세력) 】';
  const objMeaning = OBJECT_MEANINGS[obj] || OBJECT_MEANINGS['연꽃'];

  const content = `나무관세음보살. 두 손 모아 맞이합니다, ${name} 님. 이렇게 마주 앉은 것도 다 전생에 맺은 인연이지요. 사주를 펼쳐 보기 전부터 ${strongList}의 강한 기운이 느껴집니다. 자, 그럼 ${cat}운부터 한번 봅시다.

${firstHeading}
이 사주팔자라는 건, 전생에서 지어온 업과 복이 이번 생에 드러난 지도입니다. ${name} 님의 타고난 본바탕은 ${ilju}, 즉 ${ilgan}의 기운으로 서 있는 명식입니다. 겉으로는 무던해 보여도 속에는 쉽게 꺾이지 않는 단단한 심지와 뚝심이 자리 잡고 있지요. 부모 자리와 형제 자리를 들여다보면 어릴 때부터 남들보다 일찍 철이 들어 스스로 책임을 짊어져야 했던 흔적이 보입니다. 약속은 끝까지 지키고 남의 부탁을 쉽게 거절하지 못하는 깊은 신의가 장점이지만, 그로 인해 혼자 속앓이를 하거나 손해를 떠안는 경우가 있으니 선을 긋는 지혜가 필요합니다.

【 오행 기운 】
${name} 님의 사주는 ${strongList} 기운이 강하게 자리하고 있습니다. 강한 기운은 전생에 넉넉히 지어온 복이라 추진력과 결단력, 사람을 끌어당기는 힘으로 드러납니다. 다만 기운이 한쪽으로 쏠리면 일을 벌여놓고 마무리에서 지치거나 기운이 새는 자리가 생기기 쉽습니다. 반대로 비어 있거나 약한 ${weakList} 기운은 이번 생에 닦으라고 비워둔 자리입니다. 조급함을 내려놓고 꾸준히 키우는 인내를 기르면 비로소 큰 복이 열립니다. 부족해서 보충하면 좋은 용신(用神)은 '${yong}' 기운이니, 흐름과 지혜로 균형을 잡는 것이 핵심입니다.

【 타고난 살(殺) 】
살은 업의 자국입니다. 피할 게 아니라 알고 닦으면 오히려 큰 공덕이 됩니다. 사주에 나타난 ${sinsal}의 기운을 보면, 남다른 직관력과 예리함, 그리고 한자리에 머물지 않고 움직이며 길을 여는 역동성이 함께 들어 있습니다. 혼자 깊이 사색하는 시간이 ${name} 님을 살리는 힘이 되며, 무엇보다 결정적인 고비마다 손을 내밀어 주는 귀인(貴人)의 복이 분명히 자리하고 있습니다.

【 지금 마음 】
${name} 님께서 '${obj}'을(를) 고르셨지요. ${objMeaning} 경전에 일체유심조(一切唯心造), 모든 건 마음이 짓는다 하였습니다. 지금 마음을 한 겹 닫아둔 것은 함부로 휘둘리지 않으려는 신중함이기도 합니다. 다만 그동안 혼자 다 감당하느라 마음이 많이 지쳐 있는 상태이니, 이제 무거운 짐을 하나씩 내려놓으셔도 괜찮습니다.

【 ${cat}운, 지금 흐름 】
지금 마음이 이렇게 지치고 닫힌 건 사실 ${cat} 문제가 뜻대로 풀리지 않아서입니다. 마음이 무거우니 결정을 자꾸 미루게 되고, 다가오는 기회 앞에서도 한 발 물러서게 되는 것이지요. 버는 힘과 타고난 재주는 분명히 출중한데 마무리와 사람 관계에서 새는 지점이 있습니다. 허나 걱정은 조금 내려놓으셔도 됩니다. 하늘이 무너져도 솟아날 구멍은 있는 법이며, ${name} 님 사주에 타고난 귀인의 복과 머지않아 인연이 익어 열리는 대운이 들어오면 흐름이 크게 바뀝니다. 그럼 이게 언제 풀리는지, 무엇을 어떻게 준비해야 하는지 궁금하시겠지요.

【 맺음 말씀 】
아… ${cat}운은 여기서 멈추기엔 아쉽네요. 이렇게 출중한 재주와 머지않은 운을 타고났는데 아직 그 복을 활짝 못 펴고 있어 안타깝습니다. 사주 너머에 ${cat}운이 정확히 언제 트이는지, 그리고 피해야 할 선택과 개운법이 더 남아 있습니다. 이어 보시려면 작은 정성이 필요하답니다. 하지만 얻어가시는 방향에 비하면 절대 큰 정성은 아니에요. ${cat}운을 계속 이어서 확인해보시겠어요?

더 묻고 싶은 게 있겠지요. 골라서 물어봐요.
- ${cat}운이 언제쯤 시원하게 트이는지 알 수 있을까요?
- 지금 막히고 새는 흐름을 어떻게 막아야 하나요?
- 사람 때문에 생기는 문제도 해결될까요?
- 제 타고난 재주를 어떤 방향으로 써야 가장 좋을까요?
- 평생 타고난 ${cat} 그릇은 어느 정도인가요?
- 앞으로 가장 조심해야 할 시기나 선택이 있을까요?`;

  return { choices: [{ message: { content } }] };
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // Inspect generated prompt endpoint: GET / POST /api/prompt-preview
    if (pathname === '/api/prompt-preview' && req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const promptObj = body.kind === 'paid' ? buildPaidPrompt(body) : buildFreePrompt(body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(promptObj, null, 2));
      return;
    }

    // Handle API routes (/api/saju, /api/deepseek)
    if (pathname.startsWith('/api/') && req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const parsedBody = JSON.parse(rawBody || '{}');

      // If /api/deepseek and user provided their own DEEPSEEK_API_KEY or OPENAI_API_KEY, use prompts.mjs directly!
      if (pathname === '/api/deepseek' && parsedBody.kind !== 'ping' && (DEEPSEEK_API_KEY || OPENAI_API_KEY)) {
        try {
          const llmData = await callDirectLLM(parsedBody);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(llmData));
          return;
        } catch (err) {
          console.error('Direct LLM error, falling back:', err.message);
        }
      }

      try {
        const upstreamRes = await fetch(`${REMOTE_BASE}${pathname}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': REMOTE_BASE,
            'Referer': `${REMOTE_BASE}/saju-app.html`,
          },
          body: rawBody,
        });

        if (upstreamRes.ok) {
          const data = await upstreamRes.text();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(data);
          return;
        }
      } catch (err) {
        // Fallback to local computation if offline or upstream fails
      }

      const fallbackData =
        pathname === '/api/saju' ? fallbackSaju(parsedBody) : fallbackReading(parsedBody);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(fallbackData));
      return;
    }

    // Serve static files
    let relPath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(__dirname, safePath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);

    // Support HTTP Range requests for video/audio streaming (.mp4, .mp3)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`✨ 반야사주 로컬 서버가 실행 중입니다: http://localhost:${PORT}`);
});
