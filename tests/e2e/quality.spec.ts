import { expect, test } from '@playwright/test';

const sites=[
  ['Sparaton','http://127.0.0.1:4321/'],
  ['Aspheral','http://127.0.0.1:4322/'],
  ['ILMP','http://127.0.0.1:4323/'],
  ['Admin','http://127.0.0.1:4324/']
] as const;

test('representative sites keep semantic entry points and no horizontal overflow',async({page})=>{
  for(const[name,url]of sites){
    await page.goto(url);
    await expect(page.locator('h1').first(),`${name} needs a visible h1`).toBeVisible();
    const skip=page.getByRole('link',{name:/skip to content/i});
    await expect(skip,`${name} needs a skip link`).toHaveAttribute('href','#content');
    await expect(page.locator('#content'),`${name} skip target must exist`).toHaveCount(1);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,`${name} horizontally overflows`).toBeLessThanOrEqual(1);
  }
});

test('contact controls have programmatic labels and keyboard focus is visible',async({page})=>{
  await page.goto('http://127.0.0.1:4321/contact');
  const controls=page.locator('input:not([type="hidden"]), textarea, select');
  for(let i=0;i<await controls.count();i++){
    const control=controls.nth(i);
    if(!await control.isVisible())continue;
    const labelled=await control.evaluate((element)=>{
      const id=element.getAttribute('id');
      return Boolean(element.closest('label')||element.getAttribute('aria-label')||element.getAttribute('aria-labelledby')||(id&&document.querySelector(`label[for="${CSS.escape(id)}"]`)));
    });
    expect(labelled,`visible form control ${i} lacks an accessible label`).toBe(true);
  }
  await page.keyboard.press('Tab');
  const focused=page.locator(':focus');
  await expect(focused).toBeVisible();
  const outline=await focused.evaluate(el=>getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});

test('Admin is non-indexable and non-cacheable at metadata and HTTP layers',async({page,request})=>{
  const response=await request.get('http://127.0.0.1:4324/');
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive');
  expect(response.headers()['cache-control']).toBe('no-store');
  await page.goto('http://127.0.0.1:4324/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/i);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
});

test('public pages stay server-rendered and lightweight by default',async({page})=>{
  for(const url of ['http://127.0.0.1:4321/','http://127.0.0.1:4321/services','http://127.0.0.1:4322/','http://127.0.0.1:4323/']){
    await page.goto(url);
    expect(await page.locator('astro-island').count(),`${url} unexpectedly hydrates an Astro island`).toBe(0);
    expect(await page.locator('script[src]').count(),`${url} has an unexpectedly large script surface`).toBeLessThanOrEqual(3);
  }
});

test('sitemap and feed surfaces stay public-only',async({request})=>{
  const sitemap=await request.get('http://127.0.0.1:4321/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const xml=await sitemap.text();
  expect(xml).not.toContain('admin.sparaton.com');
  expect(xml).not.toMatch(/\/tickets\//);
  const rss=await request.get('http://127.0.0.1:4321/rss.xml');
  expect(rss.ok()).toBe(true);
  expect(rss.headers()['content-type']).toMatch(/xml/);
});
