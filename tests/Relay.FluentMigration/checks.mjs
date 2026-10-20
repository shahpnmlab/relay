const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const cwd=fileURLToPath(new URL('../../', import.meta.url));
const artifacts=process.env.FLUENT_TEST_ARTIFACTS ?? join(tmpdir(),'relay-fluent-migration');
mkdirSync(artifacts,{recursive:true});
const server=spawn('dotnet',['run','--project','ComponentDev/ComponentDev.csproj','--no-build','--no-launch-profile','--urls','http://127.0.0.1:5131'],{cwd,env:{...process.env,ASPNETCORE_ENVIRONMENT:'Development',DOTNET_ENVIRONMENT:'Development'}});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const sockets=new Set();
const proxy=createServer(client=>{
 const upstream=connect(5131,'127.0.0.1');
 for(const socket of [client,upstream]){sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});}
 client.on('data',data=>setTimeout(()=>{if(!upstream.destroyed)upstream.write(data)},150));
 upstream.on('data',data=>setTimeout(()=>{if(!client.destroyed)client.write(data)},150));
 client.on('end',()=>setTimeout(()=>upstream.end(),200));upstream.on('end',()=>setTimeout(()=>client.end(),200));
});
let browser;
try{
 for(let i=0;i<100&&!serverLog.includes('Now listening');i++)await new Promise(r=>setTimeout(r,100));
 if(!serverLog.includes('Now listening'))throw new Error(serverLog);
 await new Promise(r=>proxy.listen(5132,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
 const page=await browser.newPage({viewport:{width:1280,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url());});
 await page.goto('http://127.0.0.1:5132/fluent-migration'+(process.env.FLUENT_TEST_DELAY ? '?delay='+encodeURIComponent(process.env.FLUENT_TEST_DELAY) : ''));
 await page.locator('#migration-text input').waitFor();
 await page.waitForTimeout(2000);

 await page.screenshot({path:join(artifacts,'controls.png')});


 const input=page.locator('#migration-text input');
 const text='abcdefghijklmnopqrstuvwxyz';
 await input.pressSequentially(text,{delay:20});
 await page.waitForTimeout(1500);
 assert.equal(await input.inputValue(),text);
 assert.equal(await page.locator('#migration-text-value').innerText(),text);
 await input.press('Home');await input.press('ArrowRight');await input.pressSequentially('XYZ',{delay:20});
 await page.waitForTimeout(1500);
 assert.equal(await input.inputValue(),'aXYZbcdefghijklmnopqrstuvwxyz');
 console.log('PASS immediate typing and middle-of-text editing at 300ms RTT');
 const job=page.locator('#migration-job-string input');
 await job.pressSequentially(text,{delay:20});await page.waitForTimeout(1500);
 assert.equal(await job.inputValue(),text);assert.equal(await page.locator('#migration-job-value').innerText(),text);
 console.log('PASS job string wrapper at 300ms RTT');
 const slider=page.locator('fluent-slider');
 for(let i=0;i<5;i++)await slider.press('ArrowRight',{delay:20});
 await page.waitForTimeout(1000);assert.equal(await page.locator('#migration-slider-value').innerText(),'30');
 console.log('PASS slider keyboard updates');
 const disabled=page.locator('fluent-text-input[disabled][inputmode="numeric"] input');
 assert.equal(await disabled.inputValue(),'1.25');console.log('PASS disabled fractional number');
 await page.locator('fluent-button').filter({hasText:'Choose an option'}).click();
 await page.locator('fluent-popover-b[opened="true"] fluent-option').filter({hasText:'Second'}).click();
 await page.waitForTimeout(800);assert.equal(await page.locator('#migration-selected').innerText(),'Second');
 console.log('PASS shared listbox popup and selection');
 await page.locator('fluent-button').filter({hasText:'Confirm action'}).click();
 await page.locator('fluent-button').filter({hasText:"Yes, I'm really sure"}).click();
 await page.waitForTimeout(800);assert.equal(await page.locator('#migration-confirmed').innerText(),'1');
 console.log('PASS confirmation popup');
 await page.locator('fluent-button').filter({hasText:'Open dialog'}).click();
 await page.locator('fluent-button').filter({hasText:'Accept'}).click();
 await page.waitForTimeout(800);assert.equal(await page.locator('#migration-dialog-result').innerText(),'Accepted');
 console.log('PASS dialog result');
 await page.locator('fluent-button').filter({hasText:'Show notification'}).click();
 await page.getByText('Migration notification',{exact:true}).waitFor();console.log('PASS notification');
 await page.locator('fluent-button').filter({hasText:'Dark theme'}).click();await page.waitForTimeout(800);
 assert.equal(await page.locator('body').getAttribute('data-theme'),'dark');
 await page.locator('fluent-button').filter({hasText:'Light theme'}).click();await page.waitForTimeout(800);
 assert.notEqual(await page.locator('body').getAttribute('data-theme'),'dark');console.log('PASS theme switching');
 await page.getByRole('tab',{name:'Second',exact:true}).click();await page.waitForTimeout(800);
 assert.equal(await page.getByText('Second tab content',{exact:true}).isVisible(),true);console.log('PASS tabs');
 assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
}finally{
 writeFileSync(join(artifacts,'server.log'),serverLog);
 if(browser)await browser.close();for(const socket of sockets)socket.destroy();proxy.close();server.kill('SIGTERM');
}
