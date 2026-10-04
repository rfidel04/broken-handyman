const { setTimeout: delay } = require('node:timers/promises');
function overloaded(error) { return error?.status === 503 || error?.code === 503 || /\b503\b|high demand|Service Unavailable|"status"\s*:\s*"UNAVAILABLE"/i.test(error?.message || ''); }
async function retryGeneration(operation, { signal, notify = () => {}, wait = delay } = {}) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try { return await operation(attempt); }
    catch (error) {
      if (!overloaded(error) || signal?.aborted) throw error;
      if (attempt >= 2) throw Error('Gemini is busy right now. Your request is preserved below. Try again shortly, or choose another Gemini model in Settings.');
      notify(`Gemini is busy — retrying (${attempt + 1}/2)…`);
      await wait(attempt === 0 ? 1200 : 3000, undefined, { signal });
    }
  }
}
module.exports = { retryGeneration, overloaded };
