"""
Club DX — Source Code PDF Generator
Converts all TypeScript/React source files into a clean, structured PDF.
"""

import os
import sys
import io
# Windows 터미널 UTF-8 강제
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from pathlib import Path
from datetime import date

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── 경로 설정 ────────────────────────────────────────────
BASE = Path(r"C:\Users\82104\Desktop\clubhouse.app")
SRC  = BASE / "src"
OUT  = BASE / "docs" / "ClubDX_SourceCode.pdf"

TODAY = date.today().strftime("%Y-%m-%d")

# ── 색상 팔레트 ──────────────────────────────────────────
C_BLACK    = HexColor("#000000")
C_WHITE    = HexColor("#ffffff")
C_DARK     = HexColor("#111111")
C_MID      = HexColor("#333333")
C_GRAY     = HexColor("#888888")
C_LIGHT    = HexColor("#eeeeee")
C_LIGHTER  = HexColor("#f8f8f8")
C_ACCENT   = HexColor("#1a1a1a")
C_TAG_BG   = HexColor("#e8e8e8")

# ── 파일 그룹 정의 (순서 · 섹션명) ────────────────────────
FILE_GROUPS = [
    ("Context & Types",   ["src/context/AuthContext.tsx", "src/types.ts", "src/lib/supabase.ts", "src/lib/clubColors.ts"]),
    ("Entry & Routing",   ["src/main.tsx", "src/App.tsx"]),
    ("Components — Shared", [
        "src/components/Layout.tsx",
        "src/components/Navigation.tsx",
        "src/components/Navbar.tsx",
        "src/components/ProtectedRoute.tsx",
        "src/components/UserBottomNav.tsx",
        "src/components/QRScanner.tsx",
        "src/components/SubmissionModal.tsx",
        "src/components/common/BackButton.tsx",
        "src/components/common/EmptyState.tsx",
        "src/components/common/SectionHeader.tsx",
        "src/components/ui/badge.tsx",
        "src/components/ui/button.tsx",
        "src/components/ui/card.tsx",
        "src/components/ui/dropdown-menu.tsx",
    ]),
    ("Components — Admin", [
        "src/components/admin/MemberDetailModal.tsx",
        "src/components/admin/ScheduleModal.tsx",
    ]),
    ("Pages — Admin", [
        "src/pages/admin/AdminDashboard.tsx",
        "src/pages/admin/MemberManagement.tsx",
        "src/pages/admin/MemberDetail.tsx",
        "src/pages/admin/AttendanceDetail.tsx",
        "src/pages/admin/AttendanceQR.tsx",
        "src/pages/admin/AssignmentStatus.tsx",
        "src/pages/admin/Schedules.tsx",
        "src/pages/admin/AdminRecruitment.tsx",
        "src/pages/admin/AdminProjects.tsx",
        "src/pages/admin/AdminProjectDetail.tsx",
        "src/pages/admin/Settings.tsx",
    ]),
    ("Pages — User", [
        "src/pages/user/Dashboard.tsx",
        "src/pages/user/WeeklyRoadmap.tsx",
        "src/pages/user/ClubList.tsx",
        "src/pages/user/ClubDetail.tsx",
        "src/pages/user/UserProjects.tsx",
        "src/pages/user/ProjectDetail.tsx",
        "src/pages/user/UserRecruitments.tsx",
        "src/pages/user/Portfolio.tsx",
        "src/pages/user/Profile.tsx",
        "src/pages/user/MyActivities.tsx",
        "src/pages/user/ScheduleCalendarPage.tsx",
        "src/pages/user/ScheduleDetail.tsx",
        "src/pages/user/ThreeWeekSummaryCard.tsx",
    ]),
    ("Pages — Explore", [
        "src/pages/explore/Projects.tsx",
        "src/pages/explore/Recruitment.tsx",
        "src/pages/Dashboard.tsx",
        "src/pages/AllProjects.tsx",
    ]),
]

# ── 페이지 레이아웃 ───────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN_L = 18 * mm
MARGIN_R = 18 * mm
MARGIN_T = 20 * mm
MARGIN_B = 18 * mm

# ── 스타일 ────────────────────────────────────────────────
styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

STYLE_COVER_TITLE = S("CoverTitle",
    fontName="Helvetica-Bold", fontSize=34,
    leading=44, textColor=C_WHITE, alignment=TA_CENTER)

STYLE_COVER_SUB = S("CoverSub",
    fontName="Helvetica", fontSize=13,
    leading=20, textColor=HexColor("#aaaaaa"), alignment=TA_CENTER)

STYLE_COVER_META = S("CoverMeta",
    fontName="Helvetica", fontSize=10,
    leading=16, textColor=HexColor("#666666"), alignment=TA_CENTER)

STYLE_SECTION = S("Section",
    fontName="Helvetica-Bold", fontSize=16,
    leading=22, textColor=C_WHITE, spaceBefore=0, spaceAfter=4)

STYLE_FILE_HEADER = S("FileHeader",
    fontName="Helvetica-Bold", fontSize=10,
    leading=14, textColor=C_WHITE, spaceBefore=0, spaceAfter=0)

STYLE_FILE_PATH = S("FilePath",
    fontName="Helvetica", fontSize=8,
    leading=12, textColor=HexColor("#aaaaaa"), spaceBefore=0, spaceAfter=6)

STYLE_CODE = S("Code",
    fontName="Courier", fontSize=7.2,
    leading=11, textColor=HexColor("#222222"),
    backColor=HexColor("#f8f8f8"),
    leftIndent=8, rightIndent=4,
    wordWrap='CJK', splitLongWords=True)

STYLE_CODE_LAST = S("CodeLast",
    fontName="Courier", fontSize=7.2,
    leading=11, textColor=HexColor("#222222"),
    backColor=HexColor("#f8f8f8"),
    leftIndent=8, rightIndent=4,
    spaceAfter=8,
    wordWrap='CJK', splitLongWords=True)

STYLE_TOC_SECTION = S("TocSection",
    fontName="Helvetica-Bold", fontSize=10,
    leading=16, textColor=C_BLACK, spaceBefore=8)

STYLE_TOC_FILE = S("TocFile",
    fontName="Courier", fontSize=8,
    leading=13, textColor=C_MID, leftIndent=12)

STYLE_STATS = S("Stats",
    fontName="Helvetica", fontSize=9,
    leading=14, textColor=C_GRAY, alignment=TA_CENTER)

# ── 헤더 / 푸터 ───────────────────────────────────────────
class PageDecorator:
    def __init__(self):
        self.page_num = 0

    def __call__(self, canvas, doc):
        self.page_num += 1
        canvas.saveState()
        w = PAGE_W

        if doc.page == 1:  # 표지 — 헤더/푸터 없음
            canvas.restoreState()
            return

        # 상단 헤더 라인
        canvas.setStrokeColor(HexColor("#dddddd"))
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_L, PAGE_H - MARGIN_T + 4*mm, w - MARGIN_R, PAGE_H - MARGIN_T + 4*mm)

        canvas.setFont("Helvetica-Bold", 7)
        canvas.setFillColor(HexColor("#999999"))
        canvas.drawString(MARGIN_L, PAGE_H - MARGIN_T + 5.5*mm, "CLUB DX — SOURCE CODE")
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(w - MARGIN_R, PAGE_H - MARGIN_T + 5.5*mm, f"Generated {TODAY}")

        # 하단 푸터 라인
        canvas.line(MARGIN_L, MARGIN_B - 4*mm, w - MARGIN_R, MARGIN_B - 4*mm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(HexColor("#aaaaaa"))
        canvas.drawRightString(w - MARGIN_R, MARGIN_B - 7*mm, f"{doc.page}")

        canvas.restoreState()

# ── 유틸 ─────────────────────────────────────────────────
def safe_text(text: str) -> str:
    """XML-safe + 너무 긴 토큰 자르기"""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # 연속 공백은 그대로 유지 (Courier)
    return text

def read_file(rel_path: str):
    path = BASE / rel_path
    if not path.exists():
        return None, None
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        content = path.read_text(encoding="latin-1")
    lines = content.splitlines()
    return content, lines

def count_stats(lines):
    total = len(lines)
    blank = sum(1 for l in lines if l.strip() == "")
    comment = sum(1 for l in lines if l.strip().startswith("//") or l.strip().startswith("*") or l.strip().startswith("/*"))
    return total, total - blank - comment, blank, comment

def make_code_block(lines):
    """코드 줄 → Paragraph 리스트 (줄번호 + 내용, 개별 단락으로 페이지 자동 분할)"""
    items = []
    last = len(lines)
    for i, line in enumerate(lines, 1):
        raw = line.rstrip()
        code_text = safe_text(raw) if raw else " "  # 빈 줄도 배경 유지
        num_str = f"<font color='#bbbbbb'>{i:4d} </font>"
        style = STYLE_CODE_LAST if i == last else STYLE_CODE
        para = Paragraph(num_str + code_text, style)
        items.append(para)
    return items

# ── 표지 만들기 ───────────────────────────────────────────
def make_cover():
    story = []

    # 검정 배경 직사각형은 canvas에서 그리는 게 낫지만
    # Platypus에서는 배경색 테이블로 처리
    cover_data = [[""]]
    cover_table = Table(cover_data, colWidths=[PAGE_W - MARGIN_L - MARGIN_R], rowHeights=[90*mm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C_DARK),
        ("ROUNDEDCORNERS", [12]),
        ("BOX", (0,0), (-1,-1), 0, C_DARK),
    ]))

    # 타이틀 레이어 (테이블 위에 올릴 수 없으므로 별도 Paragraph)
    story.append(Spacer(1, 28*mm))

    title_table_data = [[
        Paragraph("Club DX", STYLE_COVER_TITLE)
    ]]
    tt = Table(title_table_data, colWidths=[PAGE_W - MARGIN_L - MARGIN_R], rowHeights=[40*mm])
    tt.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C_BLACK),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ROUNDEDCORNERS", [16]),
        ("LEFTPADDING", (0,0), (-1,-1), 20),
        ("RIGHTPADDING", (0,0), (-1,-1), 20),
    ]))
    story.append(tt)
    story.append(Spacer(1, 6*mm))

    sub_data = [[Paragraph("동아리 관리 플랫폼 — 전체 소스코드", STYLE_COVER_SUB)]]
    st = Table(sub_data, colWidths=[PAGE_W - MARGIN_L - MARGIN_R])
    st.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), HexColor("#111111")),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ROUNDEDCORNERS", [12]),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
    ]))
    story.append(st)
    story.append(Spacer(1, 8*mm))

    # 기술 스택 뱃지
    stack_items = ["React 19", "TypeScript", "Vite", "Tailwind CSS v4", "Supabase", "motion/react"]
    badge_cells = [[Paragraph(f"  {t}  ", S(f"b{i}",
        fontName="Helvetica-Bold", fontSize=8, textColor=C_BLACK,
        borderPadding=(4,8,4,8))) for i, t in enumerate(stack_items)]]
    bt = Table(badge_cells, colWidths=[(PAGE_W - MARGIN_L - MARGIN_R) / len(stack_items)] * len(stack_items))
    bt.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C_LIGHT),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ROUNDEDCORNERS", [8]),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("INNERGRID", (0,0), (-1,-1), 0.3, HexColor("#cccccc")),
        ("BOX", (0,0), (-1,-1), 0.3, HexColor("#cccccc")),
    ]))
    story.append(bt)
    story.append(Spacer(1, 10*mm))

    # 메타 정보
    # 파일 수 계산
    total_files = sum(len(files) for _, files in FILE_GROUPS)
    total_lines = 0
    for _, files in FILE_GROUPS:
        for f in files:
            _, lines = read_file(f)
            if lines:
                total_lines += len(lines)

    meta_data = [[
        Paragraph(f"{total_files} Files", STYLE_COVER_META),
        Paragraph(f"{total_lines:,} Lines", STYLE_COVER_META),
        Paragraph(f"{TODAY}", STYLE_COVER_META),
    ]]
    mt = Table(meta_data, colWidths=[(PAGE_W - MARGIN_L - MARGIN_R) / 3] * 3)
    mt.setStyle(TableStyle([
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(mt)

    story.append(PageBreak())
    return story, total_files, total_lines

# ── 목차 ─────────────────────────────────────────────────
def make_toc():
    story = []

    toc_header_data = [[Paragraph("Table of Contents", S("TH",
        fontName="Helvetica-Bold", fontSize=20, textColor=C_WHITE))]]
    toc_header = Table(toc_header_data, colWidths=[PAGE_W - MARGIN_L - MARGIN_R], rowHeights=[16*mm])
    toc_header.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C_BLACK),
        ("ALIGN", (0,0), (-1,-1), "LEFT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ROUNDEDCORNERS", [12]),
        ("LEFTPADDING", (0,0), (-1,-1), 14),
    ]))
    story.append(toc_header)
    story.append(Spacer(1, 6*mm))

    for section_name, files in FILE_GROUPS:
        story.append(Paragraph(f"▸  {section_name}", STYLE_TOC_SECTION))
        for f in files:
            path = BASE / f
            if path.exists():
                _, lines = read_file(f)
                lc = f"({len(lines)} lines)" if lines else "(not found)"
                story.append(Paragraph(f"{path.name}  <font color='#aaaaaa'>{lc}</font>", STYLE_TOC_FILE))
        story.append(Spacer(1, 2*mm))

    story.append(PageBreak())
    return story

# ── 섹션 헤더 ─────────────────────────────────────────────
def make_section_header(name: str):
    data = [[Paragraph(name, STYLE_SECTION)]]
    t = Table(data, colWidths=[PAGE_W - MARGIN_L - MARGIN_R], rowHeights=[12*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C_BLACK),
        ("ALIGN", (0,0), (-1,-1), "LEFT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ROUNDEDCORNERS", [10]),
        ("LEFTPADDING", (0,0), (-1,-1), 12),
    ]))
    return [Spacer(1, 4*mm), t, Spacer(1, 4*mm)]

# ── 파일 블록 ─────────────────────────────────────────────
def make_file_block(rel_path: str):
    content, lines = read_file(rel_path)
    path = BASE / rel_path
    story = []

    if lines is None:
        story.append(Paragraph(f"⚠ {path.name} — 파일 없음", STYLE_FILE_PATH))
        return story

    total, code_l, blank_l, comment_l = count_stats(lines)

    # 파일 헤더 바
    header_text = path.name
    meta_text = f"{rel_path}  ·  {total} lines  ·  code {code_l}  ·  blank {blank_l}  ·  comment {comment_l}"

    header_data = [[
        Paragraph(header_text, STYLE_FILE_HEADER),
        Paragraph(meta_text, S("fm", fontName="Helvetica", fontSize=7, textColor=HexColor("#aaaaaa"), alignment=TA_RIGHT))
    ]]
    header_table = Table(header_data,
        colWidths=[(PAGE_W - MARGIN_L - MARGIN_R) * 0.35, (PAGE_W - MARGIN_L - MARGIN_R) * 0.65],
        rowHeights=[8*mm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), HexColor("#1a1a1a")),
        ("ALIGN", (0,0), (0,0), "LEFT"),
        ("ALIGN", (1,0), (1,0), "RIGHT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ROUNDEDCORNERS", [8]),
        ("LEFTPADDING", (0,0), (0,0), 10),
        ("RIGHTPADDING", (1,0), (1,0), 10),
    ]))

    # 코드 줄 — Table 없이 개별 Paragraph로 직접 추가 (자동 페이지 분할)
    code_paras = make_code_block(lines)

    story.append(KeepTogether([header_table, code_paras[0]] if code_paras else [header_table]))
    if len(code_paras) > 1:
        story.extend(code_paras[1:])
    story.append(Spacer(1, 6*mm))
    return story

# ── 메인 빌드 ─────────────────────────────────────────────
def build_pdf():
    print(f"[START] Club DX PDF 생성 시작...")
    print(f"        출력 경로: {OUT}")

    decorator = PageDecorator()

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title="Club DX — Source Code",
        author="Club DX Team",
        subject="React + TypeScript + Supabase 동아리 관리 플랫폼",
    )

    story = []

    # 1. 표지
    cover, total_files, total_lines = make_cover()
    story.extend(cover)

    # 2. 목차
    story.extend(make_toc())

    # 3. 섹션별 소스코드
    for section_name, files in FILE_GROUPS:
        story.extend(make_section_header(section_name))
        for i, rel_path in enumerate(files):
            print(f"  ✓  {rel_path}")
            story.extend(make_file_block(rel_path))
            # 섹션 마지막 파일 뒤에는 PageBreak
            if i < len(files) - 1:
                # 각 파일마다 구분선
                story.append(HRFlowable(width="100%", thickness=0.3, color=HexColor("#dddddd"), spaceAfter=4))
        story.append(PageBreak())

    # 빌드
    doc.build(story, onFirstPage=decorator, onLaterPages=decorator)

    size_mb = OUT.stat().st_size / 1024 / 1024
    print(f"\n[DONE] 완료!")
    print(f"       파일: {OUT.name}")
    print(f"       크기: {size_mb:.1f} MB")
    print(f"       총 파일 수: {total_files}")
    print(f"       총 줄 수: {total_lines:,}")

if __name__ == "__main__":
    build_pdf()
