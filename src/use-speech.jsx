import { useRef,useState,useEffect } from 'react';
import { createSpeechConnection } from './speech-connection.mjs';
export function useSpeech(callbacks) {
  const latest=useRef(callbacks);latest.current=callbacks;
  const connection=useRef(null);const [partialTranscript,setPartial]=useState('');
  function handlers(){return {...latest.current,
    onPartialTranscript:data=>{setPartial(data.text);latest.current.onPartialTranscript?.(data);},
    onCommittedTranscript:data=>{setPartial('');latest.current.onCommittedTranscript?.(data);},
    onDisconnect:()=>{connection.current=null;latest.current.onDisconnect?.();}
  };}
  useEffect(()=>()=>connection.current?.close(),[]);
  return {
    partialTranscript,
    async connect({token}) {connection.current?.close();setPartial('');connection.current=createSpeechConnection({token,callbacks:handlers});},
    disconnect(){connection.current?.close();connection.current=null;},
    sendAudio(audio){connection.current?.sendAudio(audio);}
  };
}
