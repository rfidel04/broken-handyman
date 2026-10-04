const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const EXTENSIONS = ['m','py','js','ts','html','css','json','txt'];
async function installedApps(home) {
  const found = {matlab:null,cursor:null};
  for(const directory of ['/Applications',path.join(home,'Applications')]) {
    let entries;try{entries=await fs.readdir(directory,{withFileTypes:true});}catch{continue;}
    for(const item of entries) {
      if(/^MATLAB.*\.app$/i.test(item.name))found.matlab=path.join(directory,item.name);
      if(item.name==='Cursor.app')found.cursor=path.join(directory,item.name);
    }
  }
  return found;
}
function validateExport(data) {
  if(typeof data?.content!=='string' || !data.content.trim())throw Error('Generate or write some code first.');
  if(!EXTENSIONS.includes(data.extension))throw Error('Choose a supported file type.');
  if(!['matlab','cursor','choose','reveal'].includes(data.target))throw Error('Choose an available app.');
  if(data.target==='matlab' && data.extension!=='m')throw Error('Choose MATLAB (.m) as the file type before opening in MATLAB.');
}
async function openMac(appPath,filePath) { await execute('/usr/bin/open',['-a',appPath,filePath]); }
module.exports = {installedApps,validateExport,openMac};
