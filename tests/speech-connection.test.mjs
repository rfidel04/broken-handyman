import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechConnection} from '../src/speech-connection.mjs';
class Socket extends EventTarget {
 static OPEN=1;readyState=1;static instance;
 constructor(){super();Socket.instance=this;} close(){this.closed=true;}send(){}
 frame(data){this.dispatchEvent(new MessageEvent('message',{data}));}
}
test('malformed frame does not lose the following final transcript',()=>{
 const transcript=[],warnings=[],errors=[];
 createSpeechConnection({token:'test',Socket,callbacks:()=>({onCommittedTranscript:d=>transcript.push(d.text),onWarning:m=>warnings.push(m),onError:e=>errors.push(e)})});
 Socket.instance.frame(']');Socket.instance.frame(JSON.stringify({message_type:'committed_transcript',text:'Write MATLAB code.'}));
 assert.deepEqual(transcript,['Write MATLAB code.']);assert.equal(warnings.length,1);assert.equal(errors.length,0);assert.ok(!Socket.instance.closed);
});
test('repeated unreadable frames report recoverable error',()=>{
 const errors=[];createSpeechConnection({token:'test',Socket,callbacks:()=>({onError:e=>errors.push(e)})});
 for(let i=0;i<3;i++)Socket.instance.frame(']');assert.equal(errors.length,1);assert.match(errors[0].message,/transcript is preserved/);
});
test('stopping a connection ignores late malformed frames',()=>{
 let errors=0;const connection=createSpeechConnection({token:'test',Socket,callbacks:()=>({onError:()=>errors++})});
 connection.close();for(let i=0;i<3;i++)Socket.instance.frame(']');assert.equal(errors,0);
});
