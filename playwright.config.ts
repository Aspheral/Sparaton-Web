import { defineConfig, devices } from '@playwright/test';

const server=(workspace:string,port:number)=>({
  command:`npm --workspace ${workspace} run dev -- --host 127.0.0.1 --port ${port}`,
  url:`http://127.0.0.1:${port}`,
  reuseExistingServer:!process.env.CI,
  timeout:120_000
});

export default defineConfig({
  testDir:'./tests/e2e',
  fullyParallel:true,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?1:0,
  reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
  webServer:[
    server('@sparaton/studios',4321),
    server('@sparaton/aspheral',4322),
    server('@sparaton/ilmp',4323),
    server('@sparaton/admin',4324)
  ],
  use:{
    baseURL:'http://127.0.0.1:4321',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[
    {name:'chromium',use:{...devices['Desktop Chrome']}},
    {name:'firefox',use:{...devices['Desktop Firefox']}},
    {name:'webkit',use:{...devices['Desktop Safari']}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}}
  ]
});
