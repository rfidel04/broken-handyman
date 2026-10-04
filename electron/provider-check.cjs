module.exports = async function check(window, app) {
  try {
    if (process.argv.includes('--check-generation')) {
      const result = await window.webContents.executeJavaScript(`(async () => {
        try { const response = await window.desktop.generate({id:'generation-check',mode:'code',content:'',instruction:'Create a MATLAB script that visualizes different polynomial equations on a graph.'}); return {ok:true,content:response.content}; }
        catch(error) {return {ok:false,error:String(error.message)};}
      })()`);
      if (result.ok) { await require('node:fs/promises').writeFile(require('node:path').join(app.getPath('temp'),'broken-handyman-polynomials.m'),result.content); console.log('Gemini check: generated MATLAB script, '+result.content.length+' characters'); }
      else console.log('Gemini check:',result.error.replace(/(?:wss?|https?):\/\/\S+/g,'[url]').replace(/AIza[A-Za-z0-9_-]+/g,'[redacted]'));
      app.exit(result.ok ? 0 : 1); return;
    }
    const result = await window.webContents.executeJavaScript(`(async () => {
      const config = await window.desktop.settings();
      if(!config.eleven)return {stage:'settings',status:'No ElevenLabs key configured'};
      try {
        const token = await window.desktop.token();
        return await new Promise(resolve => {
          const params=new URLSearchParams({model_id:'scribe_v2_realtime',token,commit_strategy:'vad',audio_format:'pcm_16000'});
          const socket=new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/realtime?'+params);
          const timer=setTimeout(()=>{socket.close();resolve({stage:'connection',status:'timeout'})},10000);
          const finish=result=>{clearTimeout(timer);socket.close();resolve(result)};
          socket.onmessage=event=>{try{const data=JSON.parse(event.data);finish({stage:'provider',status:data.message_type})}catch{finish({stage:'provider',status:'invalid response'})}};
          socket.onerror=()=>finish({stage:'connection',status:'transport failed'});
        });
      } catch(error) {
        return {stage:'token',status:error.message.includes('unlocked')?'Saved key could not be unlocked':error.message.includes('microphone')?'Microphone permission denied':'Token request failed'};
      }
    })()`);
    console.log('Speech provider check:', JSON.stringify(result));
    app.exit(result.status === 'session_started' ? 0 : 1);
  } catch { console.log('Speech provider check: unavailable'); app.exit(1); }
};
