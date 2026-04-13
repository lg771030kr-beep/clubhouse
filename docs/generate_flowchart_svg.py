"""
Club DX — 앱 스크린샷 기반 플로우차트 SVG 생성기
Figma에서 바로 열 수 있는 SVG 파일을 생성합니다.
"""
import base64
import os
from pathlib import Path

SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"
OUTPUT_FILE = Path(__file__).parent / "clubdx-flowchart-screens.svg"

# ── SVG 캔버스 ──────────────────────────────────────────────────────────────
CANVAS_W = 2600
CANVAS_H = 2200

# ── 노드 썸네일 크기 ────────────────────────────────────────────────────────
NW = 280   # 노드 너비
NH = 175   # 노드 높이
PR = 12    # 모서리 반경
PW = NW + 24  # 팝업 너비 (조금 더 넓게)
PH = NH + 20  # 팝업 높이

def b64(filename):
    """이미지를 base64 data URI로 변환"""
    path = SCREENSHOTS_DIR / filename
    if not path.exists():
        print(f"  [경고] 파일 없음: {filename}")
        return None
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    ext = path.suffix.lower().lstrip(".")
    mime = "image/png" if ext == "png" else "image/jpeg"
    return f"data:{mime};base64,{data}"

def node(nid, x, y, label, filename, w=NW, h=NH, is_popup=False, badge=None):
    """스크린샷 임베딩 노드 SVG 반환"""
    uri = b64(filename)
    shadow = 'filter="url(#shadow)"' if not is_popup else 'filter="url(#popup-shadow)"'
    stroke_color = "#e91e63" if is_popup else "#cccccc"
    stroke_w = 3 if is_popup else 1.5

    badge_svg = ""
    if badge:
        bx, by = x + w // 2, y - 14
        badge_svg = f'''
  <rect x="{bx - 50}" y="{by - 12}" width="100" height="24" rx="12" fill="{badge["color"]}" />
  <text x="{bx}" y="{by + 5}" text-anchor="middle" font-size="11" font-weight="700" fill="white">{badge["text"]}</text>'''

    if uri:
        img_tag = f'<image href="{uri}" x="{x}" y="{y}" width="{w}" height="{h}" clip-path="url(#clip-{nid})" preserveAspectRatio="xMidYMid slice"/>'
    else:
        img_tag = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#e0e0e0"/><text x="{x+w//2}" y="{y+h//2}" text-anchor="middle" fill="#888" font-size="13">{label}</text>'

    label_y = y + h + 20
    return f'''
  <defs>
    <clipPath id="clip-{nid}">
      <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{PR}"/>
    </clipPath>
  </defs>
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{PR}" fill="white" stroke="{stroke_color}" stroke-width="{stroke_w}" {shadow}/>
  {img_tag}
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{PR}" fill="none" stroke="{stroke_color}" stroke-width="{stroke_w}"/>
  <text x="{x + w//2}" y="{label_y}" text-anchor="middle" font-size="12" font-weight="700" fill="#222">{label}</text>
  {badge_svg}'''

def arrow(x1, y1, x2, y2, label="", color="#555", dashed=False):
    """화살표 SVG 반환"""
    dash = 'stroke-dasharray="8,4"' if dashed else ""
    marker = f'marker-end="url(#ah-{color.lstrip("#")})"'

    # 중간점 계산 (L자 또는 직선)
    mx = (x1 + x2) / 2
    my = (y1 + y2) / 2

    path = f"M {x1} {y1} L {x2} {y2}"

    label_svg = ""
    if label:
        lx, ly = mx, my - 8
        label_svg = f'<text x="{lx}" y="{ly}" text-anchor="middle" font-size="10" fill="{color}" font-weight="600">{label}</text>'

    return f'''
  <path d="{path}" stroke="{color}" stroke-width="2" fill="none" {dash} {marker}/>
  {label_svg}'''

def elbow(x1, y1, x2, y2, label="", color="#555", dashed=False, via=None):
    """꺾이는 화살표"""
    dash = 'stroke-dasharray="8,4"' if dashed else ""
    marker = f'marker-end="url(#ah-{color.lstrip("#")})"'

    if via:
        vx, vy = via
        path = f"M {x1} {y1} L {vx} {vy} L {x2} {y2}"
    else:
        path = f"M {x1} {y1} L {x1} {y2} L {x2} {y2}" if abs(x2-x1) > abs(y2-y1) else f"M {x1} {y1} L {x2} {y1} L {x2} {y2}"

    label_svg = ""
    if label:
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        label_svg = f'<text x="{mx}" y="{my - 8}" text-anchor="middle" font-size="10" fill="{color}" font-weight="600">{label}</text>'

    return f'''
  <path d="{path}" stroke="{color}" stroke-width="2" fill="none" {dash} {marker}/>
  {label_svg}'''

# ── 화살표 마커 정의 ─────────────────────────────────────────────────────────
ARROW_COLORS = ["555555","1565c0","c62828","2e7d32","f57f17","e91e63","6a1b9a","00838f","e65100"]

def make_markers():
    markers = ""
    for c in ARROW_COLORS:
        markers += f'''
    <marker id="ah-{c}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0,8 3,0 6" fill="#{c}"/>
    </marker>'''
    return markers

# ── 레이아웃 좌표 ──────────────────────────────────────────────────────────
# 유저 섹션
UD_X, UD_Y   = 80,  180    # 유저 대시보드
CL_X, CL_Y  = 440, 180    # 동아리 살펴보기
PR_X, PR_Y  = 800, 180    # 프로필 (계정정보)
SC_X, SC_Y  = 440, 430    # 일정 캘린더
QR_X, QR_Y  = 80,  430    # QR 스캔 팝업
PF_X, PF_Y  = 800, 430    # 포트폴리오 (열린)
PC_X, PC_Y  = 800, 680    # 포트폴리오 (접힌)

# 어드민 섹션
AD_X, AD_Y   = 1200, 180  # 어드민 대시보드
MM_X, MM_Y   = 1200, 430  # 부원 관리
MD_X, MD_Y   = 1560, 430  # 부원 상세 모달
AT_X, AT_Y   = 1200, 680  # 출결 확인
SM_X, SM_Y   = 1560, 180  # 일정 관리
SA_X, SA_Y   = 1560, 680  # 일정 등록 모달 (활동)
ST_X, ST_Y   = 1920, 680  # 일정 등록 모달 (과제)
SB_X, SB_Y   = 1920, 430  # 일정 등록 모달 (활동+과제)
AS_X, AS_Y   = 1200, 930  # 과제 제출 현황
SD_X, SD_Y   = 1560, 930  # 과제 제출 상세 모달
RC_X, RC_Y   = 1920, 180  # 모집공고 관리

# ── 섹션 레이블 Y ────────────────────────────────────────────────────────────
SECTION_LABEL_Y = 130

def main():
    print("플로우차트 SVG 생성 중...")

    nodes_svg = ""
    arrows_svg = ""

    # ── 섹션 배경 ──────────────────────────────────────────────────────────
    sections = f'''
  <!-- 유저 섹션 배경 -->
  <rect x="40" y="140" width="1100" height="580" rx="20" fill="#f0f7ff" stroke="#90caf9" stroke-width="2.5" stroke-dasharray="10,5"/>
  <text x="60" y="{SECTION_LABEL_Y}" font-size="16" font-weight="900" fill="#1565c0" letter-spacing="1">👤  USER</text>

  <!-- 어드민 섹션 배경 -->
  <rect x="1160" y="140" width="1400" height="850" rx="20" fill="#f1f8e9" stroke="#a5d6a7" stroke-width="2.5" stroke-dasharray="10,5"/>
  <text x="1180" y="{SECTION_LABEL_Y}" font-size="16" font-weight="900" fill="#2e7d32" letter-spacing="1">⚙️  ADMIN</text>

  <!-- 팝업/모달 그룹 레이블 -->
  <text x="80" y="{QR_Y - 30}" font-size="12" font-weight="700" fill="#e91e63">[ POPUP ]</text>
  <text x="1200" y="{MD_Y - 30}" font-size="12" font-weight="700" fill="#e91e63">[ POPUP ]</text>
  <text x="1560" y="{SA_Y - 30}" font-size="12" font-weight="700" fill="#e91e63">[ MODAL — 탭 전환 ]</text>

  <!-- 모달 탭 연결 배경 -->
  <rect x="1545" y="{SA_Y - 15}" width="{(SB_X+PW+20) - 1545}" height="{PH+30}" rx="14" fill="#fce4ec" stroke="#f48fb1" stroke-width="1.5" stroke-dasharray="6,3"/>
'''

    # ── 노드 생성 ──────────────────────────────────────────────────────────
    print("  노드 생성 중...")

    # 유저 섹션
    nodes_svg += node("ud",  UD_X, UD_Y, "유저 대시보드",          "01_user_dashboard.png")
    nodes_svg += node("cl",  CL_X, CL_Y, "동아리 살펴보기",        "03_club_list.png")
    nodes_svg += node("pr",  PR_X, PR_Y, "프로필 (계정정보)",      "02_profile.png")
    nodes_svg += node("sc",  SC_X, SC_Y, "일정 캘린더",            "04_schedule_calendar.png")
    nodes_svg += node("qr",  QR_X, QR_Y, "QR 출석 스캔",           "popup_qr_scan.png",     is_popup=True)
    nodes_svg += node("pf",  PF_X, PF_Y, "포트폴리오 (열린 상태)", "page_portfolio_open.png")
    nodes_svg += node("pc",  PC_X, PC_Y, "포트폴리오 (접힌 상태)", "page_portfolio_collapsed.png")

    # 어드민 섹션
    nodes_svg += node("ad",  AD_X, AD_Y, "관리자 대시보드",        "08_admin_dashboard.png")
    nodes_svg += node("mm",  MM_X, MM_Y, "부원 관리",              "09_admin_members.png")
    nodes_svg += node("md",  MD_X, MD_Y, "부원 상세 모달",         "popup_member_detail.png",  is_popup=True)
    nodes_svg += node("at",  AT_X, AT_Y, "출결 확인",              "10_admin_attendance.png")
    nodes_svg += node("sm",  SM_X, SM_Y, "일정 관리",              "11_admin_schedules.png")
    nodes_svg += node("sa",  SA_X, SA_Y, "일정 등록 — 활동",       "popup_schedule_modal_activity.png", is_popup=True)
    nodes_svg += node("st",  ST_X, ST_Y, "일정 등록 — 과제",       "popup_schedule_modal_task.png",     is_popup=True)
    nodes_svg += node("sb",  SB_X, SB_Y, "일정 등록 — 활동+과제",  "popup_schedule_modal_both.png",     is_popup=True)
    nodes_svg += node("as",  AS_X, AS_Y, "과제 제출 현황",         "page_admin_assignments.png")
    nodes_svg += node("sd",  SD_X, SD_Y, "과제 제출 상세 모달",    "popup_submission_detail.png",       is_popup=True)
    nodes_svg += node("rc",  RC_X, RC_Y, "모집공고 관리",          "13_admin_recruitment.png")

    print("  화살표 생성 중...")

    # ── 화살표 ─────────────────────────────────────────────────────────────
    # 유저 섹션 연결
    arrows_svg += elbow(UD_X+NW, UD_Y+NH//2,  CL_X,       CL_Y+NH//2,   "동아리 살펴보기", "#1565c0")
    arrows_svg += elbow(UD_X+NW, UD_Y+NH//2,  PR_X,       PR_Y+NH//2,   "프로필",         "#6a1b9a",  via=(PR_X-40, UD_Y+NH//2))
    arrows_svg += elbow(UD_X+NW//2, UD_Y+NH,  QR_X+NW//2, QR_Y,         "QR출석하기",     "#e91e63")
    arrows_svg += elbow(UD_X+NW, UD_Y+NH//2,  SC_X,       SC_Y+NH//2,   "일정 보기",      "#f57f17",  via=(SC_X-40, UD_Y+NH//2))
    arrows_svg += elbow(PR_X+NW//2, PR_Y+NH,  PF_X+NW//2, PF_Y,         "포트폴리오",     "#555555")
    arrows_svg += elbow(PF_X+NW//2, PF_Y+NH,  PC_X+NW//2, PC_Y,         "접기 토글",      "#888888")
    arrows_svg += elbow(PC_X+NW//2, PC_Y,     PF_X+NW//2, PF_Y+NH,      "펼치기 토글",    "#888888", dashed=True)

    # USER → ADMIN 토글
    arrows_svg += elbow(UD_X+NW, UD_Y+20,  AD_X, AD_Y+20, "토글 (운영진 전환)", "#e65100", dashed=True,
                        via=(UD_X+NW+40, UD_Y+20))

    # 어드민 내부 연결
    arrows_svg += elbow(AD_X+NW//2, AD_Y+NH, MM_X+NW//2, MM_Y,         "부원 관리",       "#2e7d32")
    arrows_svg += elbow(AD_X+NW,    AD_Y+NH//2, SM_X,    SM_Y+NH//2,   "일정 관리",       "#f57f17")
    arrows_svg += elbow(AD_X+NW//2, AD_Y+NH, AT_X+NW//2, AT_Y,         "출결 확인",       "#00838f", via=(AD_X+NW//2, AT_Y))
    arrows_svg += elbow(AD_X+NW,    AD_Y+NH//2, RC_X,    RC_Y+NH//2,   "모집공고",        "#6a1b9a", via=(RC_X-40, AD_Y+NH//2))
    arrows_svg += elbow(AD_X+NW//2, AD_Y+NH, AS_X+NW//2, AS_Y,         "과제 현황",       "#c62828", via=(AD_X+NW//2, AS_Y))

    # 부원 → 모달
    arrows_svg += elbow(MM_X+NW, MM_Y+NH//2,   MD_X,       MD_Y+NH//2,  "부원 클릭",       "#e91e63")

    # 일정 관리 → 모달 탭
    arrows_svg += elbow(SM_X+NW//2, SM_Y+NH,    SA_X+NW//2, SA_Y,        "새 일정 등록",    "#e91e63")
    # 모달 탭 간 연결
    arrows_svg += arrow(SA_X+PW,   SA_Y+NH//2,  ST_X,        ST_Y+NH//2,  "과제 전용 탭",   "#e91e63")
    arrows_svg += elbow(SA_X+PW,   SA_Y+NH//2,  SB_X,        SB_Y+NH//2,  "활동+과제 탭",   "#e91e63", via=(ST_X+PW, SA_Y+NH//2))

    # 과제 → 모달
    arrows_svg += elbow(AS_X+NW, AS_Y+NH//2,   SD_X,        SD_Y+NH//2,  "제출파일 클릭",  "#e91e63")

    print("  SVG 파일 작성 중...")

    # ── 최종 SVG 조합 ──────────────────────────────────────────────────────
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="0 0 {CANVAS_W} {CANVAS_H}" width="{CANVAS_W}" height="{CANVAS_H}"
  font-family="'Apple SD Gothic Neo', -apple-system, 'Malgun Gothic', sans-serif">

<defs>
  <!-- 그림자 필터 -->
  <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
    <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#00000025"/>
  </filter>
  <filter id="popup-shadow" x="-15%" y="-15%" width="130%" height="130%">
    <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#e91e6340"/>
  </filter>

  <!-- 화살표 마커 -->
  {make_markers()}
</defs>

<!-- 배경 -->
<rect width="{CANVAS_W}" height="{CANVAS_H}" fill="#f8f8f8"/>

<!-- 제목 -->
<text x="40" y="60" font-size="24" font-weight="900" fill="#111" letter-spacing="-0.5">Club DX — 앱 플로우차트</text>
<text x="40" y="88" font-size="13" fill="#888">실제 앱 화면 기반 · 핑크 테두리 = 팝업/모달 · 점선 화살표 = 토글 전환</text>

<!-- 범례 -->
<rect x="40" y="100" width="18" height="3" rx="1" fill="#cccccc"/>
<text x="64" y="113" font-size="11" fill="#888">일반 페이지</text>
<rect x="160" y="100" width="18" height="3" rx="1" fill="#e91e63"/>
<text x="184" y="113" font-size="11" fill="#888">팝업/모달</text>
<line x1="270" y1="102" x2="288" y2="102" stroke="#555" stroke-width="2" stroke-dasharray="5,3"/>
<text x="295" y="113" font-size="11" fill="#888">토글 전환</text>

{sections}
{nodes_svg}
{arrows_svg}

</svg>'''

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(svg)

    size_kb = OUTPUT_FILE.stat().st_size // 1024
    print(f"\nDone! saved: {OUTPUT_FILE}")
    print(f"   size: {size_kb} KB")
    print(f"   Figma: File > Import > clubdx-flowchart-screens.svg")

if __name__ == "__main__":
    main()
