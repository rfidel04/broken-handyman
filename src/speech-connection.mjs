export function createSpeechConnection({token,callbacks,Socket=WebSocket}) {
  const params = new URLSearchParams({model_id:'scribe_v2_realtime',token,commit_strategy:'vad',audio_format:'pcm_16000'});
  const socket = new Socket('wss://api.elevenlabs.io/v1/speech-to-text/realtime?' + params);
  let ended = false, malformed = 0;
  const events = {auth_error:'onAuthError',quota_exceeded:'onQuotaExceededError',unaccepted_terms:'onUnacceptedTermsError',rate_limited:'onRateLimitedError',input_error:'onInputError',transcriber_error:'onTranscriberError',resource_exhausted:'onResourceExhaustedError',session_time_limit_exceeded:'onSessionTimeLimitExceededError',insufficient_audio_activity:'onInsufficientAudioActivityError',chunk_size_exceeded:'onError',queue_overflow:'onError',error:'onError'};
  function dispatch(name,data){ callbacks()[name]?.(data); }
  socket.addEventListener('message',event=>{
    if (ended) return;
    let data;
    try {data=JSON.parse(event.data);} catch {
      malformed++;
      if(malformed>=3) dispatch('onError',new Error('ElevenLabs sent repeated unreadable messages. Your latest transcript is preserved; reconnect to try again.'));
      else dispatch('onWarning','An unreadable speech message was skipped — still listening.');
      return;
    }
    if(!data || typeof data !== 'object' || Array.isArray(data)) return;
    malformed=0;
    // Callback exceptions must never be mislabeled as transport/JSON failures.
    if(data.message_type==='session_started') dispatch('onSessionStarted');
    else if(data.message_type==='partial_transcript' && typeof data.text==='string') dispatch('onPartialTranscript',data);
    else if(data.message_type==='committed_transcript' && typeof data.text==='string') dispatch('onCommittedTranscript',data);
    else if(events[data.message_type]) {
      const error=new Error(typeof data.error==='string'?data.error:'ElevenLabs could not continue the speech session.');
      dispatch(events[data.message_type],error);
    }
  });
  socket.addEventListener('error',()=>{if(!ended)dispatch('onError',new Error('The ElevenLabs connection was interrupted. Check your internet connection and reconnect.'));});
  socket.addEventListener('close',event=>{
    if(ended)return;ended=true;
    if(!event.wasClean || (event.code!==1000 && event.code!==1005)) dispatch('onError',new Error('ElevenLabs ended the speech connection. Your latest transcript is preserved; reconnect to try again.'));
    dispatch('onDisconnect');
  });
  return {
    sendAudio(audio) {if(!ended && socket.readyState===Socket.OPEN)socket.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:audio,sample_rate:16000,commit:false}));},
    close() {if(ended)return;ended=true;socket.close(1000,'Microphone stopped');dispatch('onDisconnect');}
  };
}
