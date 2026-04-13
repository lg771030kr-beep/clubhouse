/**
 * 동아리별 고유 액센트 색상.
 * 1) clubs.theme_color (DB, #RRGGBB)
 * 2) 이름/카테고리 키워드 매핑 (로보트=파랑, 디자인=핑크 등)
 * 3) id 기반 해시 폴백
 */

const ACCENT_PALETTE = [
  '#2563eb', // blue
  '#db2777', // pink
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#dc2626', // red
  '#0891b2', // cyan
  '#4f46e5', // indigo
];

export type ClubColorInput = {
  id?: string;
  name?: string | null;
  category?: string | null;
  theme_color?: string | null;
};

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getClubAccentHex(club: ClubColorInput | null | undefined): string {
  if (!club) return ACCENT_PALETTE[0];

  const tc = club.theme_color?.trim();
  if (tc && /^#[0-9A-Fa-f]{6}$/.test(tc)) {
    return tc;
  }

  const blob = `${club.name || ''} ${club.category || ''}`.toLowerCase();

  if (/로보|robot|robo|임베디드|embedded|하드웨어/.test(blob)) return '#2563eb';
  if (/디자인|design|ux|ui|시각/.test(blob)) return '#db2777';
  if (/개발|dev|코딩|알고|algorithm|web|앱/.test(blob)) return '#059669';
  if (/기획|pm|기획자|product/.test(blob)) return '#d97706';
  if (/마케팅|marketing|홍보/.test(blob)) return '#7c3aed';
  if (/댄스|밴드|음악|예술|미디어/.test(blob)) return '#dc2626';

  const key = club.id || club.name || 'default';
  return ACCENT_PALETTE[simpleHash(key) % ACCENT_PALETTE.length];
}
