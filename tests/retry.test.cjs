const { test } = require('node:test');
const assert = require('node:assert/strict');
const { retryGeneration } = require('../electron/retry.cjs');
test('recovers from a transient busy model and reports retry', async () => {
 let calls=0, messages=[];
 const result=await retryGeneration(async()=>{if(++calls<3)throw Object.assign(Error('busy'),{status:503});return 'code';},{wait:async()=>{},notify:message=>messages.push(message)});
 assert.equal(result,'code');assert.equal(calls,3);assert.equal(messages.length,2);
});
test('stops retrying and returns a readable message',async()=>{
 let calls=0;
 await assert.rejects(retryGeneration(async()=>{calls++;throw Error('503 Service Unavailable')},{wait:async()=>{}}),/Your request is preserved/);
 assert.equal(calls,3);
});
test('does not retry invalid credentials',async()=>{
 let calls=0;
 await assert.rejects(retryGeneration(async()=>{calls++;throw Error('401 invalid API key')}),/401/);assert.equal(calls,1);
});
test('cancellation stops before any request',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(retryGeneration(async()=>{calls++},{signal:controller.signal}));assert.equal(calls,0);
});
