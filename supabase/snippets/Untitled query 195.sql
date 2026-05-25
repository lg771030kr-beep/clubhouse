cd C:\Users\82104\Desktop\clubhouse.app

# 파일들 순서대로 한 번에 실행
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase_schema.sql -f supabase_migration_v2.sql -f supabase_migration_v3.sql -f supabase_migration_v4.sql -f supabase_migration_v5.sql -f supabase_migration_v6.sql -f supabase_migration_v7.sql -f supabase_migration_v8.sql -f supabase_migration_v9.sql -f supabase_migration_v10.sql -f supabase_migration_v13_enable_rls.sql