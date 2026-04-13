/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// 환경 변수 타입 단언 및 fallback 설정
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase 환경 변수가 설정되지 않았습니다. 루트 디렉토리의 .env 파일을 확인해주세요.");
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);