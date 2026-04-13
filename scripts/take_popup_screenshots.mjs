import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVE_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = 'http://localhost:3000';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  // Helper: navigate via SPA pushState
  async function spaNavigate(path_) {
    await page.evaluate((p) => {
      window.history.pushState({}, '', p);
      window.dispatchEvent(new PopStateEvent('popstate', {}));
    }, path_);
    await wait(500);
  }

  // Helper: find and click button by text
  async function clickButtonByText(text) {
    const result = await page.evaluate((txt) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(txt));
      if (btn) { btn.click(); return true; }
      return false;
    }, text);
    return result;
  }

  // Helper: screenshot to PNG
  async function shot(filename) {
    const filepath = path.join(SAVE_DIR, filename);
    await page.screenshot({ path: filepath, type: 'png' });
    console.log(`Saved: ${filename}`);
  }

  // Load app first
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await wait(1000);

  // ── 1. QR 출석 스캔 팝업 ──────────────────────────────────────────
  console.log('Step 1: QR 출석 스캔 팝업');
  await spaNavigate('/dashboard');
  await clickButtonByText('QR 출석');
  await wait(500);
  await shot('popup_qr_scan.png');

  // ── 2. 부원 정보 모달 ─────────────────────────────────────────────
  console.log('Step 2: 부원 정보 모달');
  // Close any open modal first
  await page.keyboard.press('Escape');
  await wait(200);
  // Enable admin mode
  await clickButtonByText('운영진 모드 토글');
  await wait(300);
  await spaNavigate('/admin/members');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('tbody button');
    if (btns[0]) btns[0].click();
  });
  await wait(300);
  await shot('popup_member_detail.png');
  // Close modal
  await page.keyboard.press('Escape');
  await wait(200);

  // ── 3. 새 일정 등록 모달 — 활동 일정 탭 ──────────────────────────
  console.log('Step 3: 새 일정 등록 모달 — 활동 일정 탭');
  await spaNavigate('/admin/schedules');
  await clickButtonByText('새 일정');
  await wait(300);
  await shot('popup_schedule_modal_activity.png');

  // ── 4. 새 일정 등록 모달 — 과제 전용 탭 ──────────────────────────
  console.log('Step 4: 새 일정 등록 모달 — 과제 전용 탭');
  await clickButtonByText('과제 전용');
  await wait(300);
  await shot('popup_schedule_modal_task.png');

  // ── 5. 새 일정 등록 모달 — 활동+과제 탭 ──────────────────────────
  console.log('Step 5: 새 일정 등록 모달 — 활동+과제 탭');
  await clickButtonByText('활동 + 과제');
  await wait(300);
  await shot('popup_schedule_modal_both.png');

  // ── 6. 포트폴리오 — 접힌 상태 ────────────────────────────────────
  console.log('Step 6: 포트폴리오 — 접힌 상태');
  await page.keyboard.press('Escape');
  await wait(200);
  // Switch back to user mode
  await clickButtonByText('운영진 모드 토글');
  await wait(300);
  await spaNavigate('/portfolio');
  // Collapse first accordion (click to close if open, or close it)
  await clickButtonByText('활동 기록');
  await wait(300);
  await shot('page_portfolio_collapsed.png');

  // ── 7. 포트폴리오 — 열린 상태 ────────────────────────────────────
  console.log('Step 7: 포트폴리오 — 열린 상태');
  await clickButtonByText('활동 기록');
  await wait(300);
  await shot('page_portfolio_open.png');

  // ── 8. 과제 제출 현황 상세 ────────────────────────────────────────
  console.log('Step 8: 과제 제출 현황');
  // Enable admin mode
  await clickButtonByText('운영진 모드 토글');
  await wait(300);
  await spaNavigate('/admin/assignments');
  await wait(500);
  await shot('page_admin_assignments.png');
  // Try clicking submission button
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="제출"], tbody button, .submission-btn');
    if (btn) btn.click();
  });
  await wait(300);
  await shot('popup_submission_detail.png');

  await browser.close();
  console.log('All screenshots done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
