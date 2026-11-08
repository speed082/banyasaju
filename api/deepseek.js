import { buildFreePrompt, buildPaidPrompt, OBJECT_MEANINGS } from '../prompts.mjs';

const REMOTE_BASE = 'https://banyasaju.vercel.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (body.kind === 'ping') {
    return res.status(200).json({ ok: true });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';

  if (deepseekKey || openaiKey) {
    try {
      const { systemPrompt, userPrompt } =
        body.kind === 'paid' ? buildPaidPrompt(body) : buildFreePrompt(body);
      const apiUrl = deepseekKey
        ? 'https://api.deepseek.com/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const apiKey = deepseekKey || openaiKey;
      const model = deepseekKey ? 'deepseek-chat' : 'gpt-4o-mini';

      const llmRes = await fetch(apiUrl, {
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
      if (llmRes.ok) {
        const data = await llmRes.json();
        return res.status(200).json(data);
      }
    } catch (e) {
      // Fallback
    }
  }

  try {
    const upstream = await fetch(`${REMOTE_BASE}/api/deepseek`, {
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

  const content = `나무관세음보살. 두 손 모아 맞이합니다, ${name} 님. 이렇게 마주 앉은 것도 다 전생에 맺은 인연이지요. 사주를 펼쳐 보기 전부터 ${strongList}의 강한 기운이 느껴집니다. 자, 그럼 ${cat}운부터 한번 봅시다.\n\n${firstHeading}\n이 사주팔자라는 건, 전생에서 지어온 업과 복이 이번 생에 드러난 지도입니다. ${name} 님의 타고난 본바탕은 ${ilju}, 즉 ${ilgan}의 기운으로 서 있는 명식입니다.\n\n【 오행 기운 】\n${name} 님의 사주는 ${strongList} 기운이 강하고 ${weakList} 기운은 이번 생에 닦으라고 비워둔 자리입니다. 부족해서 보충하면 좋은 용신은 '${yong}' 기운입니다.\n\n【 타고난 살(殺) 】\n사주에 나타난 ${sinsal}의 기운을 보면 결정적인 고비마다 손을 내밀어 주는 귀인의 복이 자리하고 있습니다.\n\n【 지금 마음 】\n${name} 님께서 '${obj}'을(를) 고르셨지요. ${objMeaning}\n\n【 ${cat}운, 지금 흐름 】\n하늘이 무너져도 솟아날 구멍은 있는 법이며, 머지않아 인연이 익어 열리는 대운이 들어오면 흐름이 크게 바뀝니다.\n\n【 맺음 말씀 】\n아… ${cat}운은 여기서 멈추기엔 아쉽네요. 사주 너머에 ${cat}운이 정확히 언제 트이는지 더 남아 있습니다.`;

  return res.status(200).json({ choices: [{ message: { content } }] });
}
