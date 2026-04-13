import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Club } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { BackButton } from '../../components/common/BackButton';
import { EmptyState } from '../../components/common/EmptyState';

type RecruitmentClub = Club & {
  recruitment_notice?: string;
  apply_url?: string;
};

const NOTICE_PREVIEW_LENGTH = 88;

const getNotice = (club: RecruitmentClub) =>
  club.recruitment_notice ?? club.recruit_description ?? '';

const getApplyUrl = (club: RecruitmentClub) => club.apply_url ?? club.recruit_link ?? '';

const toPreview = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

export const Recruitment: React.FC = () => {
  const [clubs, setClubs] = useState<RecruitmentClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedClub, setSelectedClub] = useState<RecruitmentClub | null>(null);

  useEffect(() => {
    void fetchRecruitingClubs();
  }, []);

  const fetchRecruitingClubs = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .eq('is_recruiting', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClubs((data as RecruitmentClub[]) || []);
    } catch (error) {
      console.error('Failed to fetch recruitment posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClubs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return clubs;

    return clubs.filter((club) => {
      const notice = getNotice(club).toLowerCase();
      return (
        club.name.toLowerCase().includes(normalizedQuery) ||
        (club.category ?? '').toLowerCase().includes(normalizedQuery) ||
        notice.includes(normalizedQuery)
      );
    });
  }, [clubs, query]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-4">
          <BackButton />
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">동아리 모집 공고</h1>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="동아리명 또는 카테고리 검색"
              className="h-10 w-full rounded-md bg-white pl-9 pr-3 text-sm outline-none shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 border border-slate-200"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredClubs.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<Search className="h-8 w-8 opacity-40" />}
                message="현재 모집 중인 공고가 없습니다."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredClubs.map((club) => {
              const notice = getNotice(club);
              return (
                <Card key={club.id} className="flex h-full flex-col shadow-sm">
                  <CardHeader className="space-y-3">
                    <Badge variant="secondary" className="w-fit">
                      {club.category || '기타'}
                    </Badge>
                    <CardTitle className="line-clamp-1 text-lg">{club.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                      {toPreview(notice || '모집 공고 내용이 없습니다.', NOTICE_PREVIEW_LENGTH)}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => setSelectedClub(club)}>
                      상세 보기
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {selectedClub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="space-y-4 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Badge>{selectedClub.category || '기타'}</Badge>
                  <CardTitle className="text-2xl">{selectedClub.name}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedClub(null)} aria-label="닫기">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <h3 className="text-sm font-semibold text-slate-800">모집 공고</h3>
              <p className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {getNotice(selectedClub) || '상세 모집 공고가 없습니다.'}
              </p>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => setSelectedClub(null)}>
                닫기
              </Button>
              <Button
                onClick={() => {
                  const url = getApplyUrl(selectedClub);
                  if (!url) return;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                disabled={!getApplyUrl(selectedClub)}
              >
                지원하기
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
