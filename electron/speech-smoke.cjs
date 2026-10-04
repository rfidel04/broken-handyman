const { app, ipcMain } = require('electron');
const path = require('node:path');
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.setPath('userData',path.join(require('node:os').tmpdir(),'broken-handyman-speech-test-'+process.pid));
const created = new Promise(resolve => app.once('browser-window-created',(_,win)=>resolve(win)));
require('./main.cjs');
ipcMain.removeHandler('speech:token');
ipcMain.handle('speech:token',()=> 'local-test-token');
ipcMain.removeHandler('draft:generate');
ipcMain.handle('draft:generate', async (event,data) => { if(data.mode !== 'code') throw Error('Wrong artifact mode'); const content='x = -5:0.1:5;\nplot(x, x.^2);'; event.sender.send('draft:chunk',{id:data.id,text:content}); return {content}; });
created.then(async win => {
 await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
 const run=code=>win.webContents.executeJavaScript(code);
 const wait=async expression=>{for(let i=0;i<200;i++){if(await run(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out: '+expression)};
 try {
  await wait("!document.querySelector('.mic').disabled");
  await run(`window.__packets=0; window.__tracks=[];
    const getMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await getMedia(constraints);window.__tracks.push(...stream.getTracks());return stream;};
    window.WebSocket=class extends EventTarget {
      static OPEN=1; static CLOSED=3; readyState=0;
      constructor(){super();window.__socket=this;setTimeout(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));setTimeout(()=>this.message({message_type:'session_started',session_id:'local-test'}),10)},10)}
      message(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}))}
      send(value){if(JSON.parse(value).audio_base_64)window.__packets++}
      close(){if(this.readyState===3)return;this.readyState=3;this.dispatchEvent(new CloseEvent('close',{code:1000,wasClean:true}))}
    }; document.querySelector('.mic').click();`);
  await wait("document.querySelector('.mic').textContent.includes('Stop listening') && window.__packets > 2");
  await run("window.__socket.dispatchEvent(new MessageEvent('message',{data:']'}));window.__socket.message({message_type:'committed_transcript',text:'Dictation works.'})");
  await wait("document.querySelector('.source textarea').value === 'Dictation works.'");
  await run("document.querySelector('.mic').click()");
  await wait("window.__tracks.every(track=>track.readyState === 'ended') && document.querySelector('.mic').textContent.includes('Start speaking')");
  await run("document.querySelector('.mic').click()");
  await wait("document.querySelector('.mic').textContent.includes('Stop listening')");
  await run("window.__socket.message({message_type:'quota_exceeded',error:'Test quota exhausted'})");
  await wait("document.querySelector('footer').textContent.includes('quota is exhausted') && window.__tracks.every(track=>track.readyState === 'ended')");
  await run("document.querySelector('.segmented button:last-child').click(); const select=document.querySelector('.select-label select');select.value='assistant';select.dispatchEvent(new Event('change',{bubbles:true}));");
  await wait("document.querySelector('.select-label select').value === 'assistant' && document.querySelector('.selected').textContent.includes('Code')");
  await run("document.querySelector('.mic').click()");
  await wait("document.querySelector('.mic').textContent.includes('Stop listening')");
  await run("window.__socket.message({message_type:'committed_transcript',text:'Create a MATLAB script that plots polynomials.'})");
  await wait("document.querySelector('.source textarea').value.includes('plot(x') && !!document.querySelector('.launch-panel') && document.querySelector('footer').textContent.includes('Draft ready') && window.__tracks.every(track=>track.readyState === 'ended')");
  await run("document.querySelector('.mic').click()");
  await wait("document.querySelector('.mic').textContent.includes('Stop listening')");
  await run("window.__socket.message({message_type:'partial_transcript',text:'Create a MATLAB plot'});for(let i=0;i<3;i++)window.__socket.dispatchEvent(new MessageEvent('message',{data:']'}))");
  await wait("document.querySelector('#instruction').value === 'Create a MATLAB plot' && window.__tracks.every(track=>track.readyState === 'ended')");
  console.log('PASS: real audio processor under production security policy; PCM packets; dictation; stop releases microphone; reconnect; quota error releases microphone. No audio or credentials sent to a provider.');
  app.exit(0);
 }catch(error){console.error(error.message);console.error(await run("document.querySelector('footer').innerText"));app.exit(1)}
});
