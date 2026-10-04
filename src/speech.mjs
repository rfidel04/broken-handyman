export function speechError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Microphone access denied. Allow Broken Handyman in macOS System Settings → Privacy & Security → Microphone.';
  if (error?.name === 'NotFoundError') return 'No microphone found. Connect a microphone and try again.';
  if (error?.name === 'NotReadableError') return 'The microphone could not start. Check whether another app is using it.';
  const message = String(error?.message || error?.error || 'The speech connection closed unexpectedly.');
  const safe = message.replace(/(?:wss?|https?):\/\/\S+/gi, '[connection]').replace(/\b(?:sk_|xi_|AIza)[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 350);
  return `Speech could not start: ${safe}`;
}
export async function prepareMicrophone() {
  let stream, context, source, processor, closed = false, send = null;
  function close() {
    if (closed) return; closed = true; send = null;
    stream?.getTracks().forEach(track => track.stop());
    source?.disconnect(); processor?.disconnect();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
    context = new AudioContext({sampleRate:16000});
    await context.audioWorklet.addModule(new URL('./speech-processor.js', window.location.href));
    source = context.createMediaStreamSource(stream);
    processor = new AudioWorkletNode(context, 'broken-handyman-speech');
    processor.port.onmessage = event => {
      if (!send || closed) return;
      const bytes = new Uint8Array(event.data);
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      try { send(btoa(binary)); } catch { close(); }
    };
    source.connect(processor); processor.connect(context.destination);
    await context.resume();
    return { start(callback) { if (!closed) send = callback; }, close };
  } catch(error) { close(); throw error; }
}
