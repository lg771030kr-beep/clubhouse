-- ================================================================
-- Club DX — Migration V10
-- 동아리 아카이브 공용 문서함
-- archive_folders / archive_documents 테이블 생성
-- ================================================================

-- ① 공용 문서함 폴더
CREATE TABLE IF NOT EXISTS archive_folders (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id    uuid        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  name       text        NOT NULL,
  color      text        DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now()
);

-- ② 공용 문서함 파일
CREATE TABLE IF NOT EXISTS archive_documents (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     uuid        REFERENCES clubs(id)           ON DELETE CASCADE  NOT NULL,
  folder_id   uuid        REFERENCES archive_folders(id) ON DELETE SET NULL,
  title       text        NOT NULL,
  description text,
  file_url    text,
  file_name   text,
  file_size   bigint      DEFAULT 0,
  mime_type   text,
  created_by  uuid        REFERENCES profiles(id)        ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ③ RLS 비활성화 (개발 환경)
ALTER TABLE archive_folders  DISABLE ROW LEVEL SECURITY;
ALTER TABLE archive_documents DISABLE ROW LEVEL SECURITY;

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- 완료 체크리스트:
--   ✅ archive_folders 테이블 생성
--   ✅ archive_documents 테이블 생성
--   ✅ RLS 비활성화
--
-- ⚠️  추가 작업 필요 (Supabase 대시보드):
--   → Storage → New bucket → 이름: "archive" → Public 체크 후 생성
-- ================================================================
