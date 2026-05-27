/**
 * Supabase Edge Function: analyze-brochure
 *
 * Anthropic API 키를 서버 측에서만 사용.
 * 클라이언트는 이 함수를 호출하고, 이 함수가 Anthropic에 실제 요청을 보냄.
 *
 * 환경 변수 (Supabase Dashboard > Project Settings > Edge Functions):
 *   ANTHROPIC_API_KEY  — Anthropic secret key (서버 전용, VITE_ 접두사 없음)
 */

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

const CATEGORIES = [
  '문화/예술/공연', '봉사/사회활동', '학술/교양',
  '창업/취업', '어학', '체육', '친목', '기타',
];

const corsHeaders = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  /* CORS preflight */
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  /* ── Supabase JWT 검증 (로그인 유저만 허용) ── */
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  /* ── API 키 ── */
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API 키 미설정' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  /* ── 요청 파싱 ── */
  let base64Pdf: string;
  try {
    const body = await req.json() as { base64: unknown };
    if (typeof body.base64 !== 'string' || body.base64.length === 0) {
      throw new Error('base64 필드 없음');
    }
    // 5MB 제한 (base64는 원본보다 ~33% 크므로 실제 ~3.75MB 파일)
    if (body.base64.length > 5 * 1024 * 1024 * 1.34) {
      return new Response(JSON.stringify({ error: '파일이 너무 큽니다 (최대 5MB)' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    base64Pdf = body.base64;
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  /* ── Anthropic 호출 ── */
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':          apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
            },
            {
              type: 'text',
              text: `이 동아리 소개서에서 정보를 추출해 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "name": "동아리 이름 (없으면 null)",
  "affiliation": "소속 학교/기관 (없으면 null)",
  "club_type": "교내 또는 연합 중 해당하면 값, 없으면 null",
  "category": "${CATEGORIES.join(' / ')} 중 가장 가까운 것 하나, 없으면 null",
  "description": "소개 요약 2~3문장 (없으면 null)"
}`,
            },
          ],
        }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status}`);
    }

    const json = await res.json() as { content?: { text?: string }[] };
    const text = json.content?.[0]?.text ?? '{}';
    const parsed = JSON.parse(text) as Record<string, unknown>;

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[analyze-brochure]', err);
    return new Response(JSON.stringify({ error: '분석에 실패했습니다.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
