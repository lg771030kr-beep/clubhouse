import React from 'react';
/**
 * 대시보드「상세 일정 보기」 등에서 연결되는 경로.
 * 이전에는 WeeklyRoadmap(지난/이번/다음 주차)를 썼으나,
 * 월 캘린더 + 동아리별 그룹 UI는 ScheduleDetail과 동일하게 맞춥니다.
 */
import { ScheduleDetail } from './ScheduleDetail';

export const ScheduleCalendarPage: React.FC = () => {
  return <ScheduleDetail />;
};
