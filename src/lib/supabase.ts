/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[supabase] 환경 변수가 누락되었습니다. ' +
    'VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 .env 파일에 설정해주세요.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);