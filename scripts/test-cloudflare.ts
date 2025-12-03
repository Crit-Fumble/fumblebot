import { chromium, firefox } from 'playwright';

async function test() {
  // Try Firefox which sometimes has better luck with Cloudflare
  console.log('Trying Firefox...');
  const browser = await firefox.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log('Testing Roll20 wiki...');
  try {
    await page.goto('https://wiki.roll20.net/', { waitUntil: 'load', timeout: 60000 });

    // Wait for Cloudflare challenge to pass
    let attempts = 0;
    while (attempts < 15) {
      await page.waitForTimeout(2000);
      const title = await page.title();
      console.log('Attempt ' + (attempts + 1) + ': ' + title);
      if (!title.includes('Just a moment') && !title.includes('Cloudflare')) {
        break;
      }
      attempts++;
    }

    const title = await page.title();
    console.log('Final Roll20 title:', title);

    if (!title.includes('Just a moment')) {
      const content = await page.textContent('body');
      console.log('Roll20 body preview:', content?.substring(0, 500));
    }
  } catch (e: any) {
    console.log('Roll20 error:', e.message);
  }

  await browser.close();
  console.log('\nDone');
}

test();
