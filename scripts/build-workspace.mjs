
import { readFile, writeFile } from "node:fs/promises";
import { Script } from "node:vm";
import { applyFollowedInbox } from "./followed-inbox.mjs";
const root = new URL("../", import.meta.url);
const file = new URL("public/demo/index.html",root);
const input = await readFile(file,"utf8");
const start=input.indexOf("<script>")+8,end=input.lastIndexOf("</script>");
let script=input.slice(start,end);
function put(a,b){if(!script.includes(a))throw new Error("Workspace update point missing: "+a.slice(0,130));script=script.replace(a,()=>b)}
function replaceBetween(a,b,value){
 const i=script.indexOf(a),j=script.indexOf(b,i+a.length);
 if(i<0||j<0)throw new Error("Workspace section missing: "+a.slice(0,130));
 script=script.slice(0,i)+value+script.slice(j);
}
const edits = [
  [
    "const campaignCatalog=[{title:campaignTitle,ids:campaignMembers}];",
    "const campaignCatalog=[];"
  ],
  [
    "t=mail.get(id)||mail.get('spring-0');",
    "t=mail.get(id);"
  ],
  [
    "const c=contacts.get(id)||contacts.get('Maya Chen');",
    "const c=contacts.get(id);if(!c){notice(box,'This contact is unavailable.');return}"
  ],
  [
    "const provider=t=>accountList.find(a=>a.id===t.account);",
    "const provider=t=>accountList.find(a=>a.id===t.account)||{email:'Unknown mailbox',name:'Gmail',nickname:''};"
  ],
  [
    "function open(t){if(!t||trash.has(t.id)){toast('This conversation is unavailable.');backToMain();return}t.unread=false;go('Thread',t.id)}",
    "function open(t){return liveOpen(t)}"
  ],
  [
    "option.preview||latest.body.split('\\n')",
    "option.preview||t.preview||latest.body.split('\\n')"
  ],
  [
    "view==='Inbox'?'Gmail and Outlook'",
    "view==='Inbox'?'Gmail'"
  ],
  [
    "top.append(element('span','tag','Demo'));",
    "top.append(element('span','tag','Gmail connected'));"
  ],
  [
    "const box=content();if(note)notice(box,note);",
    "const box=content();if(note)notice(box,note);if(setupLiveView(view,box,id))return;"
  ],
  [
    "if(view==='Search'||view==='Mail history'){\n  const bar=",
    "if(view==='Search'||view==='Mail history'){liveSearch(box,header);return;\n  const bar="
  ],
  [
    "['Scheduled',()=>go('Scheduled mail')]",
    "['Refresh',()=>liveRefresh({show:true})]"
  ],
  [
    "if(!rows.length)main.append(element('p','empty','No messages in this view.'));",
    "if(liveError)notice(main,liveError);if(!rows.length)main.append(element('p','empty',liveLoading?'Loading Gmail…':'No messages in this view.'));"
  ],
  [
    "if(view==='Campaign folder'){\n  const bar=",
    "if(view==='Campaign folder'){\n  if(!campaignCatalog[activeCampaign]){notice(main,'This campaign is unavailable.');return}\n  const bar="
  ],
  [
    "campaignCatalog[activeCampaign].title:s?.[2]||view",
    "(campaignCatalog[activeCampaign]?.title||'Campaign'):s?.[2]||view"
  ],
  [
    "campaignCatalog[activeCampaign].ids.length+' recipients",
    "(campaignCatalog[activeCampaign]?.ids.length||0)+' recipients"
  ],
  [
    "m.out?(accountList.find(a=>a.id===m.account)||provider(t)).email:address(m.name)",
    "m.out?(accountList.find(a=>a.id===m.account)||provider(t)).email:(m.email||'')"
  ],
  [
    "'To '+displayName+(m.cc?' · Cc '+m.cc:'')",
    "'To '+(m.to||provider(t).email)+(m.cc?' · Cc '+m.cc:'')"
  ],
  [
    "head.append(element('p','','Sent in demo'));",
    "head.append(element('p','','Sent'));"
  ],
  [
    "  if(m.files){const files=element('div','files');m.files.forEach(f=>attachment(files,f,m));card.append(files)}",
    "  if(m.attachments?.length){\n   const files=element('div','files');\n   for(const f of m.attachments){const a=element('a','action secondary',f.name);a.download=f.name;a.href='/api/attachment?'+new URLSearchParams({account:t.account,message:m.providerMessage,id:f.id,name:f.name});files.append(a)}\n   card.append(files);\n  }"
  ],
  [
    " if(t.id==='spring-0'){const related=element('div','related');related.append(button('Create event from email',()=>go('Create event',t.id)),button('View location',()=>go('Location',t.id)));timeline.append(related)}",
    " if(!preview){const related=element('div','related');related.append(button('Create event from email',()=>go('Create event',t.id)));timeline.append(related)}"
  ],
  [
    "imports.add(t.id);hidden.delete(t.id);open(t)",
    "imports.add(t.id);hidden.delete(t.id);livePersistImports();open(t)"
  ],
  [
    "contacts.set(record.name,record);toast('Contact saved.');",
    "contacts.set(record.name,record);livePersistContacts();toast('Contact saved.');"
  ],
  [
    "if(item)tasks[index]=v;else tasks.push(v);go('To-dos')",
    "if(item)tasks[index]=v;else tasks.push(v);livePersistPlanning();go('To-dos')"
  ],
  [
    "item.done=!item.done;go('To-dos')",
    "item.done=!item.done;livePersistPlanning();go('To-dos')"
  ],
  [
    "e.title||(id?'Studio visit':'')",
    "e.title||(id?(mail.get(id)?.subject||''):'')"
  ],
  [
    "e.guests||(id?'Maya Chen, Theo Park':'')",
    "e.guests||(id?(mail.get(id)?.recipientEmail||''):'')"
  ],
  [
    "e.location||(id?'214 Mercer St, New York, NY':'')",
    "e.location||''"
  ],
  [
    "e.date||(id?'2026-11-20':pickedDate)",
    "e.date||pickedDate"
  ],
  [
    "for(const [label,send] of [['Create and send sample invite',true],['Save without sending',false]])box.append(button(label,()=>{events.push({...e,sent:send});pendingEvent=null;toast(send?'Sample invitation sent.':'Event saved.');go('Event details',String(events.length-1))},send?'action primary':'action'));",
    "box.append(button('Save event on this device',()=>{events.push({...e,sent:false});livePersistPlanning();pendingEvent=null;toast('Event saved on this device.');go('Event details',String(events.length-1))},'action primary'));"
  ],
  [
    "const upcoming=allEvents.filter(e=>e.date>='2026-11-17');",
    "const upcoming=allEvents.filter(e=>e.date>=new Date().toLocaleDateString('sv-SE'));"
  ],
  [
    "button('Google Drive',()=>{\n   extras.replaceChildren();notice(extras,'Demo Drive picker · choose a sample file.');",
    "button('Google Drive',()=>{\n   extras.replaceChildren();notice(extras,'Google Drive is not connected. Attach a local file instead.'); return;"
  ],
  [
    "scheduleMenu.append(toggle);",
    "scheduleMenu.append(element('p','muted','Scheduled live delivery is not connected yet.'));"
  ],
  [
    "f.addEventListener('submit',e=>{\n  e.preventDefault();if(!Object.values(rows).every(commit=>commit()))return;",
    "f.addEventListener('submit',async e=>{\n  e.preventDefault();if(submit.disabled||!Object.values(rows).every(commit=>commit()))return;"
  ],
  [
    "  if(schedule.required){\n   if(!schedule.value",
    "  if(false&&schedule.required){\n   if(!schedule.value"
  ],
  [
    "const known=emails();\n  for(const addr",
    "const known=emails();\n  submit.disabled=true;error.textContent='';\n  try{\n   const payload=await liveFiles(metadata.rich+liveHtmlFooter(metadata.footer),files);\n   const text=body+(metadata.footer?'\\n\\n'+metadata.footer:'');\n   if(replyThread){if(!replyThread.providerId)throw Error('Open this thread from Gmail before replying.');await liveApi('reply',{accountId:account,threadId:replyThread.providerId,body:text,cc:metadata.cc,...payload});}\n   else await liveApi('send',{accountId:account,to:recipients.To,cc:recipients.Cc,bcc:recipients.Bcc,subject:subject.value,body:text,...payload});\n  }catch(err){error.textContent=err.message;submit.disabled=false;return}\n  for(const addr"
  ],
  [
    "  const primary=[...contacts.values()].find(c=>c.email.toLowerCase()===recipients.To[0])?.name||recipients.To[0];\n  if(replyThread){replyThread.messages.push(sample(displayName,body,'Just now',{...metadata,account,subject:subject.value}));replyThread.activity=nextActivity();render();main.scrollTop=main.scrollHeight;return}const m=add('draft-'+Date.now(),primary,subject.value,account,[sample(displayName,body,'Just now',metadata)]);open(m);",
    "  livePersistContacts();\n  if(replyThread){replyThread.messages.push(sample(displayName,body,'Just now',{...metadata,account,subject:subject.value}));replyThread.activity=Date.now();toast('Reply sent through Gmail.');render();main.scrollTop=main.scrollHeight;return}\n  toast('Email sent through Gmail.');go('Inbox');"
  ],
  [
    "replyThread.recipientEmail||contacts.get(replyThread.name)?.email||address(replyThread.name)",
    "replyThread.recipientEmail||contacts.get(replyThread.name)?.email||''"
  ],
  [
    "if(!recipients.To.length||(!body&&!photoCount))",
    "if((!replyThread&&!recipients.To.length)||(!body&&!photoCount))"
  ],
  [
    "Move this conversation to Mailthread’s Trash. You can restore it or delete it forever from Trash.",
    "Move this conversation to Mailthread’s Trash. This does not delete the original in Gmail."
  ],
  [
    "Permanently delete “'+t.subject+'” from Mailthread?",
    "Permanently delete “'+t.subject+'” from Mailthread? The original stays in Gmail."
  ]
];
const adapter = "\nconst liveReadKey='mailthread.live.read.v1';\nlet liveLoading=true,liveError='',liveInboxRequest=0,liveThreadRequest=0;\nconst liveRead=()=>{try{return JSON.parse(localStorage.getItem(liveReadKey)||'{}')||{}}catch{return {}}};\nconst liveThreads=new Set();\nconst liveDate=value=>value?new Date(value).toLocaleString():'';\nconst liveAddress=raw=>String(raw||'').match(/[^\\s<>,\";]+@[a-z0-9.-]+\\.[a-z]{2,}/i)?.[0]?.toLowerCase()||'';\nconst liveName=raw=>String(raw||'').replace(/\\s*<[^>]*>/g,'').trim().replace(/^\"|\"$/g,'')||liveAddress(raw)||'Unknown sender';\nfunction liveApi(path,body){\n return fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'})\n .then(async response=>{if(response.status===401){window.top.location.href='/';throw Error('Unlock Mailthread again.')}const d=await response.json();if(!response.ok)throw Error(d.error||'Gmail request failed.');return d});\n}\nfunction liveOauth(root){\n const a=element('a','action primary','Add Gmail account');a.href='/api/connect/gmail';a.target='_top';root.append(a);\n}\nfunction liveUpsert(m,source){\n const ac=accountList.find(a=>a.id===m.accountId);if(!ac)return null;\n const id=m.accountId+':'+m.threadId;\n if(deletedThreads.has(id))return null;\n const old=mail.get(id),saved=liveRead();\n const from=m.from||'Unknown sender',name=liveName(from),email=liveAddress(from);\n const t={...old,id,providerId:m.threadId,name:old?.campaign?old.name:name,recipientEmail:old?.campaign?old.recipientEmail:email,subject:m.subject,account:m.accountId,activity:Date.parse(m.date)||0,unread:m.unread&&saved[id]!==m.revision,revision:m.revision,archive:source?false:old?old.archive:!imports.has(id),preview:m.preview,messages:old?.loadedRevision===m.revision?old.messages:[{name,email,body:m.preview||'',date:liveDate(m.date)}],loadedRevision:old?.loadedRevision};\n if(source){t.archive=false;liveThreads.add(id)}\n mail.set(id,t);\n if(email&&email!==ac.email.toLowerCase()&&!observedDirectory.some(c=>c.email===email))observedDirectory.push({name,email,account:ac.id});\n return t;\n}\nasync function liveRefresh({initial=false,show=false}={}){\n const request=++liveInboxRequest;\n if(initial||show){liveLoading=true;liveError='';if(show)render()}\n try{\n  if(initial){const {accounts}=await liveApi('accounts');accountList.splice(0,accountList.length,...accounts.filter(a=>a.provider==='gmail').map(a=>({...a,name:'Gmail',nickname:JSON.parse(localStorage.getItem('mailthread.live.nicknames')||'{}')[a.id]||''})));connected=new Set(accountList.map(a=>a.id));liveRestoreCampaigns();}\n  const data=await liveApi('mail');if(request!==liveInboxRequest)return;\n  for(const id of liveThreads)if(!imports.has(id)&&mail.has(id))mail.get(id).archive=true;\n  liveThreads.clear();data.messages.forEach(m=>liveUpsert(m,true));\n  liveError=data.unavailable?'A Gmail mailbox needs attention. Check Settings → Integrations.':'';\n }catch(e){if(request===liveInboxRequest)liveError=e.message}\n finally{if(request===liveInboxRequest){liveLoading=false;if(['Inbox','Integrations','Sync status'].includes(state.view))render()}}\n}\nasync function liveOpen(t,preview=false){\n if(!t||trash.has(t.id))return;\n const request=++liveThreadRequest,current=state;\n const mainButton=document.activeElement;if(mainButton?.tagName==='BUTTON')mainButton.disabled=true;\n try{\n  if(t.providerId){\n   const d=await liveApi('thread?account='+encodeURIComponent(t.account)+'&id='+encodeURIComponent(t.providerId));\n   if(request!==liveThreadRequest||state!==current)return;\n   t.messages=d.messages.map(m=>({\n    name:liveName(m.from),email:liveAddress(m.from),out:liveAddress(m.from)===provider(t).email.toLowerCase(),body:m.body,subject:m.subject,to:m.to,cc:m.cc,date:liveDate(m.date),attachments:m.attachments||[],providerMessage:m.id,\n   }));\n   t.loadedRevision=t.revision;\n   const other=[...t.messages].reverse().find(m=>!m.out&&m.email);\n   if(other){t.recipientEmail=other.email;t.name=other.name}\n  }\n  if(!preview){const seen=liveRead();seen[t.id]=t.revision;localStorage.setItem(liveReadKey,JSON.stringify(Object.fromEntries(Object.entries(seen).slice(-1000))));t.unread=false;}\n  go(preview?'Thread preview':'Thread',t.id);\n }catch(e){if(state===current){toast(e.message);render()}}\n finally{if(mainButton?.tagName==='BUTTON')mainButton.disabled=false}\n}\nfunction liveSearch(box,header){\n const controls=element('div','filters'),out=element('section',''),input=field(box,'Search Gmail or contacts',searchTerm,{type:'search'});\n const account=field(box,'Mailbox',searchAccount==='all'?'All mailboxes':accountLabel(accountList.find(a=>a.id===searchAccount)),{tag:'select',options:['All mailboxes',...activeAccounts().map(accountLabel)]});\n const filter=field(box,'Date range',searchDate,{tag:'select',options:['any','Past 180 days','Past 30 days']});\n let timer,sequence=0;\n for(const k of ['Contacts','Messages','Mailbox history']){\n  const b=button(k,()=>{searchKind=k;render()},'filter');b.setAttribute('aria-pressed',String(k===searchKind));controls.append(b);\n }\n header.append(controls);box.append(out);\n async function update(){\n  const token=++sequence;searchTerm=input.value.trim();searchAccount=accountByLabel(account.value)?.id||'all';searchDate=filter.value;out.replaceChildren();\n  if(searchKind==='Contacts'){\n   [...contacts].filter(([,c])=>(c.name+' '+c.email).toLowerCase().includes(searchTerm.toLowerCase())).forEach(([id,c])=>detail(out,c.email,c.name,()=>go('Contact profile',id)));\n  }else if(searchKind==='Mailbox history'&&searchTerm){\n   out.append(element('p','muted','Searching Gmail…'));\n   try{\n    const {messages}=await liveApi('mail?q='+encodeURIComponent(searchTerm));if(token!==sequence||!out.isConnected)return;\n    out.replaceChildren();messages.forEach(m=>{const t=liveUpsert(m,false);if(t&&!trash.has(t.id)&&match(t))detail(out,provider(t).email+' · '+(t.archive?'Available to import':'In Messages'),t.subject,()=>liveOpen(t,true))});\n   }catch(e){if(token===sequence){out.replaceChildren();notice(out,e.message)}}\n  }else if(searchKind==='Mailbox history'){\n   out.append(element('p','muted','Enter a keyword to search all connected Gmail accounts.'));\n  }else{\n   visibleMail().filter(t=>match(t)&&[t.subject,t.name,t.preview].join(' ').toLowerCase().includes(searchTerm.toLowerCase())).forEach(t=>out.append(entry(t,()=>liveOpen(t))));\n  }\n  if(!out.children.length)out.append(element('p','empty','No matches.'));\n }\n function match(t){const days=searchDate==='Past 30 days'?30:searchDate==='Past 180 days'?180:null;return(searchAccount==='all'||t.account===searchAccount)&&(!days||t.activity>=Date.now()-days*86400000)}\n input.addEventListener('input',()=>{searchTerm=input.value;clearTimeout(timer);sequence++;timer=setTimeout(update,320)});\n account.addEventListener('change',update);filter.addEventListener('change',update);update();\n}\nfunction setupLiveView(view,box,id){\n if(view==='Integrations'||view==='Sync status'){\n  accountList.forEach(a=>detail(box,'Gmail · Connected',[a.nickname,a.email].filter(Boolean).join(' · '),()=>go('Mailbox details',a.id)));\n  liveOauth(box);box.append(button('Refresh Gmail',()=>liveRefresh({show:true})),button('Sign out',async()=>{try{await liveApi('logout',{});window.top.location.href='/'}catch(e){notice(box,e.message)}}));\n  if(liveError)notice(box,liveError);\n  return true;\n }\n if(view==='Connect mailbox'){liveOauth(box);return true}\n if(view==='Mailbox details'){\n  const a=accountList.find(x=>x.id===id);if(!a)return true;\n  detail(box,'Gmail',a.email);\n  const f=form(box,()=>{const names=JSON.parse(localStorage.getItem('mailthread.live.nicknames')||'{}');a.nickname=nickname.value.trim();names[a.id]=a.nickname;localStorage.setItem('mailthread.live.nicknames',JSON.stringify(names));go('Integrations')},'Save nickname');\n  const nickname=field(f.f,'Nickname',a.nickname);f.submit();\n  box.append(button('Disconnect Gmail',async()=>{if(!window.confirm('Disconnect '+a.email+' from Mailthread?'))return;try{await liveApi('disconnect',{accountId:id});for(const t of mail.values())if(t.account===id)mail.delete(t.id);await liveRefresh({initial:true});go('Integrations')}catch(e){notice(box,e.message)}}));\n  return true;\n }\n if(view==='Import history'||view==='Import review'){\n  notice(box,'Messages shows recent Gmail threads. To find and add an older thread, search Mailbox history.');box.append(button('Search mailbox history',()=>{searchKind='Mailbox history';go('Search')}));return true;\n }\n if(view==='Scheduled mail'||view==='Scheduled message'){notice(box,'Scheduled live delivery is not connected yet.');return true}\n if(view==='Calendar integration'||view==='Zoom integration'||view==='Calendar disconnected'){notice(box,'This integration is not connected for live Mailthread. Calendar events can be saved on this device.');return true}\n if(view==='Notifications'){\n  const fresh=visibleMail().filter(t=>t.unread&&!muted.has(t.id)&&!muted.has(t.name));detail(box,'Unread Gmail conversations',String(fresh.length),()=>go('Inbox'));\n  detail(box,'Follow-ups',tasks.filter(t=>!t.done).length+' open',()=>go('To-dos'));\n  for(const t of fresh.slice(0,12))detail(box,t.name,t.subject,()=>liveOpen(t));return true;\n }\n return false;\n}\nfunction livePersistContacts(){\n try{localStorage.setItem('mailthread.live.contacts.v1',JSON.stringify([...contacts.entries()]))}catch{}\n}\nfunction livePersistPlanning(){\n try{localStorage.setItem('mailthread.live.planning.v1',JSON.stringify({events,tasks}))}catch{}\n}\nfunction livePersistImports(){\n try{localStorage.setItem('mailthread.live.imports.v1',JSON.stringify([...imports]))}catch{}\n}\nfunction bootLive(){\n try{for(const [key,c] of JSON.parse(localStorage.getItem('mailthread.live.contacts.v1')||'[]'))contacts.set(key,c)}catch{}\n try{const p=JSON.parse(localStorage.getItem('mailthread.live.planning.v1')||'{}');events.push(...(p.events||[]));tasks.push(...(p.tasks||[]))}catch{}\n try{for(const id of JSON.parse(localStorage.getItem('mailthread.live.imports.v1')||'[]'))imports.add(id)}catch{}\n if(new URLSearchParams(location.search).get('view')==='mailboxes')state={view:'Integrations',home:'Settings'};\n render();liveRefresh({initial:true});\n setInterval(()=>{if(state.view==='Inbox'&&document.visibilityState==='visible'&&!liveLoading)liveRefresh()},45000);\n}\n\nasync function liveFiles(html,uploads){\n const parsed=new DOMParser().parseFromString(html||'','text/html'),files=[];\n let total=0;\n async function fileFrom(url,name,cid){\n  const blob=await (await fetch(url)).blob();total+=blob.size;\n  if(total>5000000)throw Error('Attachments exceed this version’s 5 MB limit.');\n  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';\n  for(let i=0;i<bytes.length;i+=16000)binary+=String.fromCharCode(...bytes.subarray(i,i+16000));\n  files.push({name,type:blob.type.split(';')[0]||'application/octet-stream',data:btoa(binary),...(cid?{cid}:{})});\n }\n for(const attachment of uploads)await fileFrom(attachment.url,attachment.name);\n for(const img of parsed.querySelectorAll('img')){\n  const url=img.getAttribute('src')||'';\n  if(!url.startsWith('blob:')&&!url.startsWith('data:image/'))continue;\n  const cid=crypto.randomUUID();\n  await fileFrom(url,(img.alt||'image').slice(0,190),cid);img.setAttribute('src','cid:'+cid);\n }\n return {html:parsed.body.innerHTML,files};\n}\nfunction liveHtmlFooter(footer){const box=document.createElement('div');box.textContent=footer;return footer?'<div style=\"white-space:pre-wrap;margin-top:16px\">'+box.innerHTML+'</div>':''}\nfunction liveSavedCampaigns(){\n try{return JSON.parse(localStorage.getItem('mailthread.live.campaigns.v1')||'[]')}catch{return []}\n}\nfunction liveRememberCampaign(group){\n const index=campaignCatalog.findIndex(c=>c.id===group.id);\n if(index<0)return;\n const entries=liveSavedCampaigns().filter(c=>c.id!==group.id);\n const sent=group.ids.map(id=>mail.get(id)).filter(Boolean).map(m=>({id:m.id,providerId:m.providerId,recipientEmail:m.recipientEmail,name:m.name,account:m.account,activity:m.activity,status:m.status}));\n entries.push({id:group.id,title:group.title,sent});\n try{localStorage.setItem('mailthread.live.campaigns.v1',JSON.stringify(entries))}catch{}\n}\nfunction liveRestoreCampaigns(){\n const knownAccounts=new Set(accountList.map(a=>a.id));\n for(const c of liveSavedCampaigns()){\n  if(campaignCatalog.some(x=>x.id===c.id))continue;\n  const index=campaignCatalog.length,ids=[];\n  for(const m of c.sent||[]){if(!knownAccounts.has(m.account)||deletedThreads.has(m.id))continue;\n   const old=mail.get(m.id);mail.set(m.id,{...m,...old,subject:c.title,campaign:true,campaignIndex:index,archive:false,preview:old?.preview||'Sent through Gmail',messages:old?.messages||[{name:provider(m).email,out:true,date:liveDate(m.activity),body:'Sent through Gmail'}]});ids.push(m.id);\n  }\n  if(ids.length)campaignCatalog.push({id:c.id,title:c.title,ids});\n }\n}\nasync function sendLiveCampaign(d,recipients,control,status){\n if(control.disabled||!recipients.length||!window.confirm('Send '+recipients.length+' separate Gmail emails now?'))return;\n control.disabled=true;\n try{\n  const markup=sanitizeCampaign(d.html);\n  const fragment=(markup.head||'')+markup.body+liveHtmlFooter(d.footer||'');\n  const payload=await liveFiles(fragment,[]);\n  const text=(new DOMParser().parseFromString(markup.body,'text/html').body.textContent.trim()||' ')+(d.footer?'\\n\\n'+d.footer:'');\n  const index=campaignCatalog.length,group={id:crypto.randomUUID(),title:d.title,ids:[]};\n  campaignCatalog.push(group);\n  for(const [i,to] of recipients.entries()){\n   status.textContent='Sending '+(i+1)+' of '+recipients.length+'…';\n   try{\n    const sent=await liveApi('send',{accountId:d.account,to:[to.email],cc:[],bcc:[],subject:d.title,body:text,...payload});\n    const id=d.account+':'+sent.threadId;\n    const m={id,providerId:sent.threadId,recipientEmail:to.email,name:to.name,subject:d.title,account:d.account,campaign:true,campaignIndex:index,activity:Date.now(),status:'Sent',messages:[{name:provider({account:d.account}).email,out:true,body:text,date:'Just now',to:to.email}]};\n    mail.set(id,m);group.ids.push(id);liveRememberCampaign(group);\n   } catch(e){\n    status.textContent='Stopped after '+group.ids.length+' confirmed sends. '+e.message+' Check Gmail Sent before retrying.';\n    if(group.ids.length){const sentEmails=new Set(group.ids.map(id=>mail.get(id).recipientEmail));d.recipients=d.recipients.filter(r=>!sentEmails.has(r.email));}\n    else campaignCatalog.pop();\n    return;\n   }\n  }\n  campaignDraft=null;activeCampaign=index;tabFilter='All';listScroll=0;\n  toast('Campaign sent through Gmail.');go('Campaign folder');\n }catch(e){status.textContent=e.message;control.disabled=false}\n}\n";

for(const [a,b] of edits)put(a,b);
replaceBetween("const accountList=[","const footers=", "const accountList=[];\n");
replaceBetween("const calendarSeed=","const accountLabel=", "const calendarSeed=[], observedDirectory=[];\n");
replaceBetween("add('jordan'","for(const id of deletedThreads)", "");
replaceBetween("const recipients=[[","const app=document.querySelector", "const recipients=[];\n");
script=script.replace(/mailthread\.(footer|trash|csv|lists)\./g,"mailthread.live.$1.");
put("let calendarMonth=new Date(2026,10,1), pickedDate='2026-11-20';", "let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1), pickedDate=new Date().toLocaleDateString('sv-SE');");
const campaignStart=script.indexOf(" const send=button('Send to '+recipients.length+' in demo'",script.indexOf("function reviewCampaign(")),campaignEnd=script.indexOf("\n}\n",campaignStart);
if(campaignStart<0||campaignEnd<0)throw Error("Campaign delivery section missing");
script=script.slice(0,campaignStart)+` const status=element('p','');status.setAttribute('role','status');
 const send=button('Send to '+recipients.length+' through Gmail',()=>sendLiveCampaign(d,recipients,send,status),'action primary');
 send.disabled=!recipients.length||recipients.length>25||!d.title.trim()||!connected.has(d.account);
 if(recipients.length>25)notice(box,'Send up to 25 recipients in one campaign.');
 tools.append(send);box.append(tools,status);`+script.slice(campaignEnd);
script=script.replace("'Sent campaigns'","'Sent campaigns'");
script=script.replace("top.append(element('span','tag','Gmail connected'));", "top.append(element('span','tag',accountList.length?'Gmail connected':liveLoading?'Connecting…':'Gmail'));" );
script=script.replace("options:['No video','Add Zoom link']", "options:['No video']");
replaceBetween("const footers=[","let primaryFooter=", "const footers=[];\n");
replaceBetween("const mailingLists=[","try{const saved=JSON.parse(window.localStorage.getItem('mailthread.live.lists", "const mailingLists=[];\n");
const boot=script.indexOf("\nrender();");
if(boot<0)throw Error("Workspace bootstrap missing");
script=script.slice(0,boot)+'\n'+adapter+'\nbootLive();'+script.slice(boot+"\nrender();".length);
new Script(script,{filename:"mailthread-live-workspace.js"});
const html=input.slice(0,start).replace("Mailthread preview","Mailthread · Gmail workspace")+script+input.slice(end);
const updated=applyFollowedInbox(html,{live:true});
new Script(updated.slice(updated.indexOf("<script>")+8,updated.lastIndexOf("</script>")));
await writeFile(new URL("out/workspace.html",root),updated);
const demo=applyFollowedInbox(input);
new Script(demo.slice(demo.indexOf("<script>")+8,demo.lastIndexOf("</script>")));
await writeFile(new URL("out/demo/index.html",root),demo);
