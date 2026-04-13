import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVE_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = 'http://localhost:3002';  // Vite is on 3002

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--allow-running-insecure-content']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  // Intercept console
  page.on('console', msg => process.stdout.write(`[browser] ${msg.text()}\n`));

  // ── Load app and wait for it to settle ──
  console.log('Loading app...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000);

  // Check what loaded
  const title = await page.title();
  const url = await page.url();
  console.log(`Loaded: ${url} | title: ${title}`);

  // Check if dashboard rendered
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log('Body:', bodyText.replace(/\n/g, ' ').slice(0, 100));

  // Helper: navigate via SPA
  async function spaNav(path_) {
    await page.evaluate((p) => {
      window.history.pushState({}, '', p);
      window.dispatchEvent(new PopStateEvent('popstate', {}));
    }, path_);
    await wait(800);
  }

  // Helper: click button by text content
  async function clickBtn(text) {
    const clicked = await page.evaluate((txt) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(txt));
      if (btn) { btn.click(); return true; }
      return false;
    }, text);
    console.log(`  clickBtn("${text}"): ${clicked}`);
    return clicked;
  }

  // Helper: screenshot as PNG
  async function shot(filename) {
    const filepath = path.join(SAVE_DIR, filename);
    await page.screenshot({ path: filepath, type: 'png', fullPage: false });
    const size = fs.statSync(filepath).size;
    console.log(`  Saved: ${filename} (${size} bytes)`);
    return filepath;
  }

  // ── Check current state ──
  const isAdminMode = await page.evaluate(() => document.body.innerHTML.includes('ADMIN'));
  console.log('Admin mode:', isAdminMode);

  // ── 1. QR 출석 스캔 팝업 ──────────────────────────────────────────
  console.log('\nStep 1: QR 출석 스캔 팝업');
  await spaNav('/dashboard');
  await wait(500);
  await clickBtn('QR 출석');
  await wait(700);
  await shot('popup_qr_scan.png');

  // ── 2. 부원 정보 모달 ─────────────────────────────────────────────
  console.log('\nStep 2: 부원 정보 모달');
  await page.keyboard.press('Escape');
  await wait(300);

  // Enable admin mode
  await clickBtn('운영진 모드 토글');
  await wait(500);

  await spaNav('/admin/members');
  await wait(1000);

  // Wait for member data to load
  const memberCount = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
  console.log(`  Member rows: ${memberCount}`);

  if (memberCount > 0) {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('tbody button');
      if (btns[0]) btns[0].click();
    });
  } else {
    // Try clicking any button in the members area
    const clicked = await page.evaluate(() => {
      // Look for member name/row buttons
      const allBtns = Array.from(document.querySelectorAll('button'));
      console.log('All buttons:', allBtns.map(b => b.textContent.trim().slice(0,20)).join(', '));
      const memberBtn = allBtns.find(b => {
        const t = b.textContent.trim();
        return t && !['운영진 모드 토글','QR 출석','뒤로가기','신규 부원 등록'].includes(t);
      });
      if (memberBtn) { memberBtn.click(); return memberBtn.textContent.trim(); }
      return null;
    });
    console.log('  Clicked member btn:', clicked);
  }
  await wait(500);
  await shot('popup_member_detail.png');

  // Close modal
  await page.keyboard.press('Escape');
  await wait(300);

  // ── 3. 새 일정 등록 모달 — 활동 일정 탭 ──────────────────────────
  console.log('\nStep 3: 새 일정 등록 모달 — 활동 일정 탭');
  await spaNav('/admin/schedules');
  await wait(800);
  await clickBtn('새 일정');
  await wait(500);
  await shot('popup_schedule_modal_activity.png');

  // ── 4. 새 일정 등록 모달 — 과제 전용 탭 ──────────────────────────
  console.log('\nStep 4: 새 일정 등록 모달 — 과제 전용 탭');
  await clickBtn('과제 전용');
  await wait(400);
  await shot('popup_schedule_modal_task.png');

  // ── 5. 새 일정 등록 모달 — 활동+과제 탭 ──────────────────────────
  console.log('\nStep 5: 새 일정 등록 모달 — 활동+과제 탭');
  await clickBtn('활동 + 과제');
  await wait(400);
  await shot('popup_schedule_modal_both.png');

  // ── 6. 포트폴리오 — 접힌 상태 ────────────────────────────────────
  console.log('\nStep 6: 포트폴리오 — 접힌 상태');
  await page.keyboard.press('Escape');
  await wait(300);
  // Switch back to user mode
  await clickBtn('운영진 모드 토글');
  await wait(400);
  await spaNav('/portfolio');
  await wait(800);

  // Check what buttons exist
  const portfolioBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0,30))
  );
  console.log('  Portfolio buttons:', portfolioBtns.join(' | '));

  // Click 활동 기록 accordion to collapse
  await clickBtn('활동 기록');
  await wait(400);
  await shot('page_portfolio_collapsed.png');

  // ── 7. 포트폴리오 — 열린 상태 ────────────────────────────────────
  console.log('\nStep 7: 포트폴리오 — 열린 상태');
  await clickBtn('활동 기록');
  await wait(400);
  await shot('page_portfolio_open.png');

  // ── 8. 과제 제출 현황 ────────────────────────────────────────────
  console.log('\nStep 8: 과제 제출 현황');
  await clickBtn('운영진 모드 토글');
  await wait(400);
  await spaNav('/admin/assignments');
  await wait(1000);
  await shot('page_admin_assignments.png');

  // Click first submitted member li (cursor-pointer)
  const liClicked = await page.evaluate(() => {
    const li = document.querySelector('li.cursor-pointer');
    if (li) { li.click(); return true; }
    return false;
  });
  console.log('  Submission li clicked:', liClicked);
  await wait(500);
  await shot('popup_submission_detail.png');

  await browser.close();
  console.log('\nAll screenshots done!');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
