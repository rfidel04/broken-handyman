function emptyDraft() { return {content:'',input:'',events:[],history:[],voiceMode:'dictate',extension:'auto'}; }
function normalizeWorkspace(data = {}) {
  const mode = data.mode === 'code' ? 'code' : 'document';
  const workspaces = {document:emptyDraft(),code:emptyDraft()};
  if(data.workspaces && typeof data.workspaces === 'object') {
    for(const name of ['document','code']) {
      const draft=data.workspaces[name] || {};
      for(const key of ['content','input']) if(typeof draft[key]==='string')workspaces[name][key]=draft[key];
      for(const [key,limit] of [['events',10],['history',30]]) if(Array.isArray(draft[key]))workspaces[name][key]=draft[key].filter(value=>typeof value==='string').slice(-limit);
      if(draft.voiceMode==='assistant')workspaces[name].voiceMode='assistant';
      if(['auto','m','py','js','ts','html','css','json','txt'].includes(draft.extension))workspaces[name].extension=draft.extension;
    }
  } else if(typeof data.content==='string')workspaces[mode].content=data.content;
  return {version:2,mode,workspaces};
}
module.exports={emptyDraft,normalizeWorkspace};
