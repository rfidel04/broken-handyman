const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const kind = process.argv.find(arg => arg.startsWith('--profile='))?.slice(10);
if (kind) app.setPath('userData', path.join(app.getPath('appData'), kind));
const created = new Promise(resolve => app.once('browser-window-created', (_, win) => resolve(win)));
require('./main.cjs');
created.then(async win => {
  await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
  try {
    const worklet = await win.webContents.executeJavaScript(`(async () => {
      const context = new AudioContext();
      const blob = new Blob(['class Test extends AudioWorkletProcessor {process(){return true}}; registerProcessor("test",Test);'], {type:'application/javascript'});
      const url = URL.createObjectURL(blob);
      try {await context.audioWorklet.addModule(url); return {ok:true};} catch(error){return {ok:false,name:error.name};} finally {URL.revokeObjectURL(url); await context.close();}
    })()`);
    console.log('Audio processor check:', JSON.stringify(worklet));
    const config = await win.webContents.executeJavaScript('window.desktop.settings()');
    console.log('ElevenLabs key configured:',config.eleven);
    if (config.eleven) {
      const result = await win.webContents.executeJavaScript(`(async () => {
        try {
          const token = await window.desktop.token();
          if(!token || typeof token !== 'string') return {stage:'token',error:'No usable token returned'};
          return await new Promise(resolve => {
            const params = new URLSearchParams({model_id:'scribe_v2_realtime',token,commit_strategy:'vad'});
            const socket = new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/realtime?' + params);
            const timer = setTimeout(()=>{socket.close();resolve({stage:'socket',error:'Timed out'});},10000);
            const done = result => {clearTimeout(timer);socket.close();resolve(result)};
            socket.onmessage = event => {const data = JSON.parse(event.data);done({stage:'socket',type:data.message_type,error:data.error || null});};
            socket.onerror = ()=>done({stage:'socket',error:'WebSocket transport failed'});
          });
        } catch(error) {return {stage:'token',error:error.message.replace(/https?:[^\\s]+/g,'[url]')};}
      })()`);
      // Never print tokens or keys.
      console.log('Provider handshake:', JSON.stringify(result));
    }
    app.exit(worklet.ok ? 0 : 1);
  } catch(error) { console.log('Diagnostic failed:',error.name); app.exit(1); }
});
