import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useSpeech } from './use-speech.jsx';
import Markdown from 'react-markdown';
import './style.css';
import models from '../electron/models.json';
import { prepareMicrophone, speechError } from './speech.mjs';
const api = window.desktop;
function App() {
  const [apps, setApps] = useState({}); const [extension, setExtension] = useState('auto'); const [opening, setOpening] = useState(false);
  const [content, setContent] = useState(''); const [mode, setMode] = useState('document');
  const [input, setInput] = useState(''); const [status, setStatus] = useState('Ready when you are');
  const [settings, setSettings] = useState({ model: 'gemini-3.1-flash-lite' }); const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false); const [listening, setListening] = useState(false); const [connecting, setConnecting] = useState(false);
  const [voiceMode, setVoiceMode] = useState('dictate'); const [events, setEvents] = useState([]); const [ready, setReady] = useState(false);
  const [modelDraft, setModelDraft] = useState('gemini-3.1-flash-lite');
  const [keys, setKeys] = useState({ gemini: '', eleven: '' }); const [canUndo, setCanUndo] = useState(false);
  const buffers = useRef({document:{content:'',input:'',events:[],history:[],voiceMode:'dictate',extension:'auto'},code:{content:'',input:'',events:[],history:[],voiceMode:'dictate',extension:'auto'}});
  const activeMode = useRef('document');
  const current = useRef(''); const running = useRef(false); const history = useRef([]); const job = useRef(null); const voice = useRef('dictate'); const action = useRef(null); const stopped = useRef(false); const microphone = useRef(null); const connectionTimer = useRef(null); const speechFailed = useRef(false); const attempt = useRef(0); const lastPartial = useRef('');
  function update(text) { current.current = text; buffers.current[activeMode.current].content = text; setContent(text); }
  function checkpoint() { history.current.push(current.current); history.current = history.current.slice(-30); setCanUndo(true); }
  function snapshot() { return {content:current.current,input,events,history:[...history.current],voiceMode,extension}; }
  function restore(name) {
    const draft = buffers.current[name]; activeMode.current = name; current.current = draft.content;
    history.current = [...draft.history]; voice.current = draft.voiceMode; lastPartial.current = '';
    setMode(name);setContent(draft.content);setInput(draft.input);setEvents(draft.events);setVoiceMode(draft.voiceMode);setExtension(draft.extension);setCanUndo(history.current.length>0);
  }
  function switchWorkspace(name) {
    if(name === activeMode.current || running.current || listening || connecting || opening || !ready)return;
    buffers.current[activeMode.current] = snapshot();restore(name);setStatus(name === 'code' ? 'Code workspace restored' : 'Document workspace restored');
  }
  function log(text) { setEvents(old => [...old.slice(-9), text]); }
  function undo() { if (running.current) return; if (history.current.length) { update(history.current.pop()); setCanUndo(history.current.length > 0); setStatus('Last change undone'); } }
  async function save() { try { const name = await api.save({ content: current.current, mode }); if (name) setStatus(`Saved ${name}`); } catch { setStatus('Could not save the file. Please try again.'); } }
  function releaseMicrophone() { clearTimeout(connectionTimer.current); microphone.current?.close(); microphone.current = null; setConnecting(false); setListening(false); }
  function speechFailure(error) { if (speechFailed.current || (running.current && !microphone.current)) return; speechFailed.current = true; if (voice.current === 'assistant' && lastPartial.current.trim()) setInput(lastPartial.current); setStatus(speechError(error)); releaseMicrophone(); scribe.disconnect(); }
  const scribe = useSpeech({
    onWarning: message => { if (!running.current) setStatus(message); },
    onSessionStarted: () => { clearTimeout(connectionTimer.current); microphone.current?.start(audio => scribe.sendAudio(audio, {sampleRate:16000})); setConnecting(false); setListening(true); setStatus('Listening — pause briefly to finish each phrase'); },
    onDisconnect: () => { const wasActive = !!microphone.current; releaseMicrophone(); if(wasActive && !speechFailed.current) setStatus('Speech session ended — press Start speaking to reconnect'); },
    onAuthError: () => speechFailure(new Error('ElevenLabs rejected the session. Check your API key and speech-to-text access in Settings.')),
    onQuotaExceededError: () => speechFailure(new Error('ElevenLabs speech quota is exhausted. Check usage and billing in your ElevenLabs account.')),
    onUnacceptedTermsError: () => speechFailure(new Error('Accept the speech-to-text terms in your ElevenLabs account, then try again.')),
    onRateLimitedError: () => speechFailure(new Error('ElevenLabs is limiting requests. Wait briefly and try again.')),
    onInputError: speechFailure,
    onTranscriberError: speechFailure,
    onResourceExhaustedError: speechFailure,
    onSessionTimeLimitExceededError: () => speechFailure(new Error('The speech session reached its time limit. Start a new session.')),
    onInsufficientAudioActivityError: () => speechFailure(new Error('No speech was detected for too long. Start a new session when ready.')),
    onPartialTranscript: data => { lastPartial.current = data.text; },
    onCommittedTranscript: data => {
      const text = data.text.trim(); if (!text) return; lastPartial.current = ''; log(text);
      if (voice.current === 'dictate') { if (!running.current) { checkpoint(); update(current.current + (current.current ? '\n\n' : '') + text); } }
      else action.current?.(text);
    },
    onError: speechFailure,
  });
  async function toggleMic() {
    if (listening || connecting) { attempt.current++; releaseMicrophone(); scribe.disconnect(); setStatus('Microphone off'); return; }
    const request = ++attempt.current; speechFailed.current = false; setConnecting(true); setStatus('Starting microphone…');
    try {
      const capture = await prepareMicrophone();
      if (request !== attempt.current) { capture.close(); return; }
      microphone.current = capture;
      const token = await api.token();
      if (request !== attempt.current) return;
      setStatus('Connecting to ElevenLabs…');
      await scribe.connect({ token });
      connectionTimer.current = setTimeout(() => speechFailure(new Error('ElevenLabs did not start a session. Check your internet connection and try again.')), 12000);
    } catch (error) { if(request === attempt.current) speechFailure(error); }
  }
  useEffect(() => () => { clearTimeout(connectionTimer.current); microphone.current?.close(); }, []);
  async function generate(instruction = input, demo = false) {
    if (running.current || (!instruction.trim() && !demo)) return;
    if (/^undo( that)?[.!]?$/i.test(instruction.trim())) { undo(); return; }
    if (/^save( (the )?(file|document))?[.!]?$/i.test(instruction.trim())) { await save(); return; }
    checkpoint(); const previous = current.current; running.current = true; setBusy(true); stopped.current = false;
    const id = crypto.randomUUID(); job.current = id; streamText.current = ''; let result = '';
    setStatus(demo ? 'Demo — streaming a sample, no API calls' : 'Creating your draft…');
    if (listening) { releaseMicrophone(); scribe.disconnect(); }
    log(demo ? 'Demo: create a sample artifact' : instruction); setInput('');
    try {
      if (demo) {
        const sample = mode === 'code' ? '# A small starting point\nfrom pathlib import Path\n\ndef summarize_folder(folder: str) -> list[str]:\n    """List files in a folder without modifying them."""\n    return [p.name for p in Path(folder).iterdir() if p.is_file()]\n\nif __name__ == "__main__":\n    print(summarize_folder("."))\n' : '# Ideas deserve a voice\n\n## The challenge\nA hand injury can make everyday writing and coding difficult. A voice workspace lets you turn spoken ideas into a useful first draft.\n\n## The approach\nDictate naturally, review the live preview, and ask for changes using your voice. Keep control with Undo, an editable source, and local saving.\n\n## Next steps\n1. Add your API keys in Settings.\n2. Dictate your assignment or switch to Assistant mode.\n3. Ask for a draft, then refine it.\n';
        for (let i = 0; i < sample.length; i += 14) { if (stopped.current) break; result += sample.slice(i, i + 14); update(result); await new Promise(resolve => setTimeout(resolve, 25)); }
      } else {
        const response = await api.generate({ id, instruction, content: previous, mode }); result = response.content; if (result) update(result);
      }
      setStatus(stopped.current ? 'Stopped — Undo restores the previous draft' : 'Draft ready — keep shaping it');
    } catch (error) { if (!demo) setInput(instruction); update(previous); history.current.pop(); setCanUndo(history.current.length > 0); setStatus(stopped.current ? 'Stopped — previous draft restored' : `Could not create the draft: ${error.message}`); }
    finally { running.current = false; setBusy(false); job.current = null; }
  }
  action.current = text => generate(text);
  useEffect(() => { if (!api) { setStatus('Launch this project with the desktop app.'); return; }
    Promise.all([api.settings(), api.load()]).then(([config, draft]) => { setSettings(config); buffers.current = draft.workspaces; restore(draft.mode); setReady(true); }).catch(() => setStatus('Could not load local settings.'));
    return api.onChunk(({ id, text, replacement, status: progress }) => { if (job.current === id) { if (progress) { setStatus(progress); return; } const next = replacement ?? (streamText.current + text); streamText.current = next; update(next); } });
  }, []);
  const streamText = useRef('');
  useEffect(() => { if (!ready || busy) return; buffers.current[activeMode.current] = snapshot(); const payload = {version:2,mode:activeMode.current,workspaces:structuredClone(buffers.current)}; const timer = setTimeout(() => api.autosave(payload).catch(() => setStatus('Autosave failed — use Save to keep a copy.')), 250); return () => clearTimeout(timer); }, [content, mode, input, events, voiceMode, extension, canUndo, ready, busy]);
  useEffect(() => { function shortcut(event) { if ((event.metaKey || event.ctrlKey) && event.key === 's') { event.preventDefault(); save(); } } window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut); }, [mode]);
  async function switchModel(model) {
    try { setSettings(await api.configure({model})); setStatus(`Model changed to ${models.find(item => item.id === model)?.name || model}`); }
    catch(error) { setStatus(error.message); }
  }
  const inferredExtension = /\.\^|^\s*%|\b(?:linspace|polyval)\([^\n]*;|\bMATLAB\b/m.test(content + '\n' + (events[events.length-1] || '')) ? 'm' : /^(?:import |from |def )/m.test(content) ? 'py' : /<!doctype html|<html/i.test(content) ? 'html' : /\b(?:const |let |function )/m.test(content) ? 'js' : 'txt';
  const selectedExtension = extension === 'auto' ? inferredExtension : extension;
  async function openCode(target) {
    setOpening(true);
    try { const result = await api.openCode({target,extension:selectedExtension,content:current.current}); if(result)setStatus(`Saved ${result.filename} and opened it in ${result.appName}`); }
    catch(error){setStatus(error.message);}finally{setOpening(false);}
  }
  useEffect(()=>{api?.apps().then(setApps).catch(()=>{});},[]);
  function modelOptions() { return <>{!models.some(item=>item.id===settings.model) && <option value={settings.model}>{settings.model} · Previously saved</option>}{models.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</>; }
  async function configure(event) { event.preventDefault(); try { setSettings(await api.configure({ ...keys, model: modelDraft })); setKeys({ gemini: '', eleven: '' }); setShowSettings(false); setStatus('Keys saved securely on this computer'); } catch (error) { setStatus(error.message); } }
  return <div className="app"><header><div className="brand"><span className="logo">≈</span><div><b>Broken Handyman</b><small>MAKE ROOM FOR YOUR IDEAS</small></div></div><div className="header-actions"><label className="model-picker">MODEL<select aria-label="Generation model" disabled={busy || connecting || listening || !ready} value={settings.model} onChange={event=>switchModel(event.target.value)}>{modelOptions()}</select></label><span className="badge">{settings.gemini ? 'Gemini key saved' : 'Demo available'}</span><button onClick={() => {setModelDraft(settings.model);setShowSettings(true);}}>⚙ Settings</button></div></header>
    <main><aside><div className="eyebrow">YOUR VOICE, YOUR WORKSPACE</div><h1>Say it.<br/><em>Shape it.</em></h1><p className="intro">A little less typing.<br/>A lot more possibility.</p>
    <div className="segmented">{['document','code'].map(item => <button disabled={busy || listening || connecting || opening || !ready} className={mode === item ? 'selected' : ''} key={item} onClick={() => switchWorkspace(item)}>{item === 'document' ? '↗ Document' : '〈〉 Code'}</button>)}</div>
    <section className="voice-card"><div className="section-label">VOICE INPUT <span>{listening ? 'LIVE' : 'OFF'}</span></div><div className={'wave '+(listening?'active':'')}>{Array.from({length:22},(_,i)=><i key={i} style={{height:12+(i*17%43),animationDelay:`${i*45}ms`}}/>)}</div>
    <button className={'mic '+(listening?'recording':'')} disabled={busy || !ready} onClick={toggleMic}>{connecting ? '■ Cancel connection' : listening ? '■ Stop listening' : '● Start speaking'}</button>
    <label className="select-label">When I speak<select disabled={listening || busy} value={voiceMode} onChange={e=>{setVoiceMode(e.target.value);voice.current=e.target.value;}}><option value="dictate">Write my words</option><option value="assistant">Follow my instructions</option></select></label><p className="hint">{voiceMode==='dictate'?'Your words appear in the document as you pause.':'Try “Write an introduction”, “Undo that”, or “Save the file”. Generation pauses the microphone.'}</p></section>
    <section className="prompt"><label htmlFor="instruction">OR TYPE AN INSTRUCTION</label><textarea id="instruction" disabled={busy} value={input} onChange={e=>setInput(e.target.value)} placeholder="Write a short analysis of my project…"/><button className="primary" disabled={busy || !input.trim() || !ready} onClick={()=>generate()}>Create or revise ↗</button></section><button className="demo" disabled={busy || !ready} onClick={()=>generate('',true)}>Try a sample without keys →</button></aside>
    <section className="workspace"><div className="toolbar"><div><span className="dot"/> {mode==='document'?'Untitled document':'Untitled script'} <span className="muted">/ {mode==='document'?'Markdown':'Source'}</span></div><div><button disabled={!canUndo || busy} onClick={undo}>↶ Undo</button><button disabled={!content || busy} onClick={save}>Save file ↗</button>{busy && <button onClick={()=>{stopped.current=true;api.cancel();}}>Stop</button>}</div></div>
    <div className="panes"><section className="source"><div className="pane-title">{mode==='document'?'SOURCE':'CODE'} <span>EDITABLE</span></div><textarea aria-label="Artifact source" disabled={busy} spellCheck={mode!=='code'} value={content} onFocus={()=>{if(!busy)checkpoint();}} onChange={e=>update(e.target.value)} placeholder="Your next idea starts here.\n\nSpeak, type an instruction, or try the sample."/></section><section className="preview">{mode === 'code' ? <><div className="pane-title">OPEN IN AN APP <span>YOUR NEXT STEP</span></div><div className="launch-panel"><div className="launch-symbol">↗</div><h2>Take your code<br/>where you work.</h2><p>Open the latest version in your editor or coding app.</p><label>File type<select aria-label="Code file type" value={extension} disabled={busy || opening} onChange={event=>setExtension(event.target.value)}><option value="auto">Detect automatically (.{inferredExtension})</option>{[['m','MATLAB'],['py','Python'],['js','JavaScript'],['ts','TypeScript'],['html','HTML'],['css','CSS'],['json','JSON'],['txt','Plain text']].map(([value,label])=><option key={value} value={value}>{label} (.{value})</option>)}</select></label><div className="launch-buttons"><button disabled={!content.trim() || busy || opening || !apps.matlab || selectedExtension !== 'm'} onClick={()=>openCode('matlab')}><b>Open in MATLAB ↗</b><small>{apps.matlab ? selectedExtension === 'm' ? 'Edit your .m script' : 'Choose MATLAB (.m) above' : 'Not found in Applications'}</small></button><button disabled={!content.trim() || busy || opening || !apps.cursor} onClick={()=>openCode('cursor')}><b>Open in Cursor ↗</b><small>{apps.cursor ? 'Keep editing your generated code' : 'Not found in Applications'}</small></button><button disabled={!content.trim() || busy || opening} onClick={()=>openCode('choose')}>Choose another app…</button><button disabled={!content.trim() || busy || opening} onClick={()=>openCode('reveal')}>Show saved code in Finder</button></div><p className="hint">Each click saves a new copy of your current code. Opening a file lets you review and run it in the selected app.</p></div></> : <><div className="pane-title">LIVE PREVIEW <span className="live-dot">●</span></div><div className="paper">{content ? <Markdown>{content}</Markdown> : <div className="empty"><div>✧</div><h2>Watch your ideas<br/>take shape.</h2><p>Your document will appear here,<br/>one thought at a time.</p></div>}</div></>}</section></div>
    <footer><span role="status" aria-live="polite">{status}</span><span>{content.trim()?content.trim().split(/\s+/).length:0} words · {busy?'Streaming':'Saved locally after edits'}</span></footer></section></main>
    {(events.length>0 || scribe.partialTranscript) && <div className="transcript"><span>TRANSCRIPT</span> {scribe.partialTranscript || events[events.length-1]}</div>}
    {showSettings && <div className="overlay"><form className="settings" onSubmit={configure}><div className="eyebrow">MAKE IT YOURS</div><h2>Connect your tools</h2><p>Keys stay encrypted on this computer. Leave a key blank to keep the saved one.</p><label>Gemini API key <span>{settings.gemini?'Saved':'Not configured'}</span><input type="password" autoComplete="off" value={keys.gemini} onChange={e=>setKeys({...keys,gemini:e.target.value})}/></label><label>ElevenLabs API key <span>{settings.eleven?'Saved':'Not configured'}</span><input type="password" autoComplete="off" value={keys.eleven} onChange={e=>setKeys({...keys,eleven:e.target.value})}/></label><label>Gemini model<select aria-label="Settings model" disabled={busy} value={modelDraft} onChange={e=>setModelDraft(e.target.value)}>{modelOptions()}</select></label><p className="hint">{models.find(item=>item.id===modelDraft)?.description} All listed models offer a limited free tier. Your Google project’s billing tier determines whether requests cost money. This menu does not change billing.</p><p className="hint">While listening, audio is sent to ElevenLabs. Instructions and the current draft are sent to Gemini when you generate.</p><div className="buttons"><button type="button" onClick={()=>setShowSettings(false)}>Close</button><button className="primary" type="submit">Save settings</button></div></form></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
