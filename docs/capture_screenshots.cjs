const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'screenshots');

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function capture(page, filePath, fullPage = false) {
  await delay(1500);
  await page.screenshot({ path: filePath, fullPage });
  console.log('Saved:', filePath);
}

// Navigate within the SPA without reloading (preserves React state)
async function spaNavigate(page, pathname) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, pathname);
  await delay(1200);
  console.log('  SPA navigate to:', pathname, '→ actual:', await page.evaluate(() => window.location.pathname));
}

async function enableAdminMode(page) {
  // Ensure we are on dashboard (loaded fresh with React state)
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
  await delay(1000);

  // Find and click the admin mode toggle button
  const toggled = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('운영진') || (btn.getAttribute('aria-label') || '').includes('운영진')) {
        btn.click();
        return 'clicked: ' + btn.textContent.trim();
      }
    }
    return 'not found';
  });
  console.log('Admin toggle result:', toggled);
  await delay(800);

  // Verify admin mode is active by checking navbar background color (black = admin mode)
  const isAdminMode = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return false;
    const style = window.getComputedStyle(nav);
    return nav.className.includes('bg-black') || document.title.includes('ADMIN');
  });
  console.log('Admin mode active (nav check):', isAdminMode);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // ── USER PAGES (direct navigation - no auth gate) ──

  // 1. Dashboard
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
  await capture(page, `${OUT_DIR}/01_user_dashboard.png`);

  // 2. Profile
  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });
  await capture(page, `${OUT_DIR}/02_profile.png`);

  // 3. Club list (actual route: /user/clubs)
  await page.goto(`${BASE_URL}/user/clubs`, { waitUntil: 'networkidle2' });
  await capture(page, `${OUT_DIR}/03_club_list.png`);

  // 4. Schedule calendar (actual route: /schedule/calendar)
  await page.goto(`${BASE_URL}/schedule/calendar`, { waitUntil: 'networkidle2' });
  await capture(page, `${OUT_DIR}/04_schedule_calendar.png`);

  // 5. Weekly Roadmap - this is a component used inside pages, not a standalone route.
  //    Capture /schedule/detail which uses ScheduleDetail (similar to WeeklyRoadmap concept)
  await page.goto(`${BASE_URL}/schedule/detail`, { waitUntil: 'networkidle2' });
  await capture(page, `${OUT_DIR}/05_weekly_roadmap.png`);

  // 6. My Activities - component in Dashboard. Capture dashboard which embeds it.
  //    Try /explore/recruitment which shows activities-like content.
  await page.goto(`${BASE_URL}/explore/recruitment`, { waitUntil: 'networkidle2' });
  await capture(page, `${OUT_DIR}/06_my_activities.png`);

  // 7. Portfolio
  await page.goto(`${BASE_URL}/portfolio`, { waitUntil: 'networkidle2' });
  await capture(page, `${OUT_DIR}/07_portfolio.png`);

  // ── Enable admin mode ──
  await enableAdminMode(page);
  // After enabling admin mode, use SPA navigation to preserve React state

  // 8. Admin dashboard (navigate within SPA to /admin)
  await spaNavigate(page, '/admin');
  await capture(page, `${OUT_DIR}/08_admin_dashboard.png`);

  // 9. Admin members
  await spaNavigate(page, '/admin/members');
  await capture(page, `${OUT_DIR}/09_admin_members.png`);

  // 10. Admin attendance
  await spaNavigate(page, '/admin/attendance');
  await capture(page, `${OUT_DIR}/10_admin_attendance.png`);

  // 11. Admin schedules
  await spaNavigate(page, '/admin/schedules');
  await capture(page, `${OUT_DIR}/11_admin_schedules.png`);

  // 12. Admin assignments
  await spaNavigate(page, '/admin/assignments');
  await capture(page, `${OUT_DIR}/12_admin_assignments.png`);

  // 13. Admin recruitment
  await spaNavigate(page, '/admin/recruitment');
  await capture(page, `${OUT_DIR}/13_admin_recruitment.png`);

  // ── MODAL SCREENSHOTS ──

  // 14. Admin members - member detail modal
  await spaNavigate(page, '/admin/members');
  console.log('  Members page URL:', await page.evaluate(() => window.location.href));

  const clickableInfo = await page.evaluate(() => {
    const all = document.querySelectorAll('tr, li, [class*="cursor-pointer"], [role="button"], [role="row"]');
    return Array.from(all).slice(0, 15).map(el => ({
      tag: el.tagName,
      cls: el.className.toString().slice(0, 80),
      text: el.textContent.trim().slice(0, 60),
    }));
  });
  console.log('  Clickable elements on members page:', JSON.stringify(clickableInfo, null, 2));

  let memberClicked = false;
  const tbodyRows = await page.$$('tbody tr');
  console.log('  tbody tr count:', tbodyRows.length);
  if (tbodyRows.length > 0) {
    await tbodyRows[0].click();
    memberClicked = true;
  }
  if (!memberClicked) {
    const cursorItems = await page.$$('[class*="cursor-pointer"]');
    console.log('  cursor-pointer count:', cursorItems.length);
    for (const el of cursorItems) {
      const txt = await page.evaluate(e => e.textContent.trim(), el);
      if (txt && txt.length > 3) {
        await el.click();
        memberClicked = true;
        console.log('  Clicked cursor-pointer:', txt.slice(0, 40));
        break;
      }
    }
  }
  if (!memberClicked) {
    console.log('  No clickable member row found');
  }
  await delay(1500);
  await capture(page, `${OUT_DIR}/14_member_detail_modal.png`);

  // 15. Admin schedules - create schedule modal
  await spaNavigate(page, '/admin/schedules');
  console.log('  Schedules page URL:', await page.evaluate(() => window.location.href));

  const allButtonTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0);
  });
  console.log('  Buttons on schedules page:', allButtonTexts);

  const createKeywords = ['+', '추가', '생성', '만들기', '새 일정', '일정 추가', '등록', 'New', 'Create', 'Add'];
  const allBtns = await page.$$('button');
  let scheduleModalOpened = false;
  for (const btn of allBtns) {
    const text = await page.evaluate(el => el.textContent.trim(), btn);
    if (createKeywords.some(k => text.includes(k))) {
      console.log('  Clicking schedule button:', text);
      await btn.click();
      scheduleModalOpened = true;
      break;
    }
  }
  if (!scheduleModalOpened) {
    console.log('  No create schedule button found');
  }
  await delay(1500);
  await capture(page, `${OUT_DIR}/15_schedule_modal.png`);

  // 16. Dashboard - full page (re-enable admin and show admin dashboard full page)
  await spaNavigate(page, '/dashboard');
  await capture(page, `${OUT_DIR}/16_dashboard_scroll.png`, true);

  await browser.close();
  console.log('\nAll screenshots captured!');
})();
