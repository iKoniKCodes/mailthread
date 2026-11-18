
const listCss = `
#app > nav{grid-template-columns:repeat(6,minmax(0,1fr))}
#app > nav button{white-space:nowrap}
.main-menu{position:relative;margin-left:auto;flex:none;z-index:20}
.menu-toggle{width:42px;height:42px;list-style:none;display:grid;place-items:center;border:1px solid var(--line);border-radius:11px;background:#f7faff;color:var(--blue);cursor:pointer}
.menu-toggle::-webkit-details-marker{display:none}.menu-toggle:hover{background:#e9f1ff}
.menu-toggle:focus-visible,.menu-item:focus-visible{outline:3px solid #6598ee;outline-offset:2px}
.menu-glyph{width:17px;height:2px;border-radius:2px;background:currentColor;box-shadow:0 -5px currentColor,0 5px currentColor}
.main-menu .menu-panel{position:absolute;top:calc(100% + 7px);right:0;width:min(220px,calc(100vw - 32px));max-height:calc(100dvh - 75px);overflow:auto;display:grid;grid-template-columns:minmax(0,1fr);gap:3px;padding:7px;background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:0 8px 24px #19305026}
.main-menu:not([open]) .menu-panel{display:none}
.menu-panel .menu-heading{padding:5px 9px;margin:0;color:var(--muted);font-size:12px;font-weight:700}
.menu-panel .menu-item{text-align:left;min-height:42px;padding:8px 12px;border-radius:8px;font-size:14px;color:var(--ink,#172332)}
.menu-panel .menu-item:hover{background:#f1f5fd}.menu-panel .menu-item[aria-current=page]{background:#e8f0ff;color:#1456be}
#app[data-theme="Dark"] :is(.menu-toggle,.menu-panel){background:#213149;color:#dae9ff}
#app[data-theme="Dark"] .menu-item[aria-current=page]{background:#354f75;color:#eaf3ff}
.mail-list-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;border-bottom:1px solid var(--line)}
.mail-list-row .row{border-bottom:0}
.history-picker{margin:10px 16px 4px;padding:12px;border:1px solid var(--line);border-radius:12px;display:grid;gap:8px}.history-picker p{margin:0;color:var(--muted);font-size:13px}
.history-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.history-actions button:disabled{opacity:.55;cursor:default}
.history-select{display:flex;align-items:center;justify-content:center;min-width:45px;min-height:44px;margin-right:7px;color:var(--muted);font-size:12px}
.history-select input{width:18px;height:18px;accent-color:var(--blue)}
.follow-toggle{min-height:40px;margin-right:12px;border-radius:9px;color:var(--blue);font-size:12px;font-weight:700;padding:7px 10px}
.follow-toggle[aria-pressed=true]{background:#e8f0ff;color:#134eab}
.follow-empty{margin:18px 16px;padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--light,#f1f5fa)}
.follow-empty h2{margin:0;font-size:17px}.follow-empty p{font-size:14px;color:var(--muted)}
#app[data-theme="Dark"] .follow-toggle[aria-pressed=true]{background:#354f75;color:#eaf3ff}
#app[data-theme="Dark"] .follow-empty{background:#213149}
@media(max-width:390px){nav button{font-size:10px}.follow-toggle{padding-inline:6px;margin-right:7px}}
`;

const mobileWrapping = "\n/* Let every grid and flex child shrink to the available screen width. */\n#app{grid-template-columns:minmax(0,1fr);max-inline-size:100%}\n.workspace,.pane,.pane>header,.pane>main,#app>nav{min-inline-size:0;max-inline-size:100%}\n.pane>main{overflow-x:hidden}\n.mail,.content,.content form,.email-compose,.address-field,.field,.detail,.gmail-compose-panels,.csv-preview{grid-template-columns:minmax(0,1fr)}\n.mail,.content,.mail article,.mailhead,.history-picker,.mail-list-row,.campaign-editor-workspace,.campaign-frame,.campaign-preview-shell,.rich-editor{min-inline-size:0;max-inline-size:100%}\n:where(.mail,.content,.pane>header,.thread-reply-dock,.mail-list-row,.row) :where(h1,h2,h3,p,strong,small,span,label,button,a,summary){overflow-wrap:anywhere}\n.mailhead{grid-template-columns:minmax(0,1fr) minmax(0,auto)}\n.mailhead>*{min-inline-size:0}\n.mail article :is(pre,code),.rich-editor :is(pre,code){white-space:pre-wrap;overflow-wrap:anywhere}\n.mail article :is(img,table),.rich-editor :is(img,table){max-inline-size:100%;height:auto}\n.mail article table,.rich-editor table{table-layout:fixed}\n.address-line,.recipient-chips,.format-tools,.compose,.compose-extra,.gmail-compose-bar,.campaign-design-tools,.filters,.history-actions{min-inline-size:0;max-inline-size:100%}\n.address-line input{flex:1 1 9rem;min-inline-size:0}\n:where(.content,.thread-reply-dock) :is(input,textarea,select){min-inline-size:0;max-inline-size:100%}\n.files .action,.recipient-chip,.menu-panel .menu-item{max-inline-size:100%;white-space:normal;overflow-wrap:anywhere}\n@media(max-width:600px){\n .pane>header{padding-inline:clamp(10px,4vw,16px)}\n .pane>header h1{overflow-wrap:anywhere;font-size:clamp(21px,6.4vw,27px)}\n .row{grid-template-columns:36px minmax(0,1fr) minmax(0,25%);gap:7px;padding-inline:10px}\n .row .avatar{width:34px;height:34px}\n .row .subject,.row small{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}\n .row strong,.row .tail .stamp{white-space:normal}\n .mail-list-row{grid-template-columns:minmax(0,1fr) minmax(45px,auto)}\n .mail-list-row .follow-toggle{max-inline-size:80px;margin-inline-end:6px}\n .mailhead{grid-template-columns:minmax(0,1fr)}\n .main-menu .menu-panel{max-inline-size:calc(100vw - 26px)}\n #app>nav button{white-space:normal;overflow-wrap:normal;font-size:clamp(10px,2.9vw,12px);padding-inline:1px}\n .thread-reply-dock{padding-inline:10px}\n}\n";

const tracking = `
const trackedKey=hasLiveGmail?'mailthread.live.follows.v1':'mailthread.demo.follows.v1';
const readFollows=()=>{
 try{
  const v=JSON.parse(localStorage.getItem(trackedKey)||'null');
  if(v&&Array.isArray(v.threads)&&Array.isArray(v.people)&&Array.isArray(v.excluded))return v;
 }catch{}
 return {threads:hasLiveGmail?[]:['jordan','spring-0'],people:[],excluded:[]};
};
const followState=readFollows();
const followedThreads=new Set(followState.threads),followedPeople=new Set(followState.people),excludedThreads=new Set(followState.excluded);
let historyMode=false,historyRange='All dates';
const pendingHistory=new Set();
const historyRanges=['All dates','Last 180 days','Older than 180 days'];
function startHistory(){
 historyMode=true;setHistoryRange('Last 180 days',false);go('All mail');
}
function setHistoryRange(range,redraw=true){
 if(historyRange===range)return;
 historyRange=range;pendingHistory.clear();
 if(hasLiveGmail&&typeof resetAllMail==='function')resetAllMail();
 if(redraw)render();
}
function importSelectedHistory(){
 let count=0;
 for(const id of pendingHistory){
  const t=mail.get(id);if(!t||trash.has(id)||follows(t))continue;
  excludedThreads.delete(id);followedThreads.add(id);count++;
 }
 pendingHistory.clear();historyMode=false;saveFollows();
 toast(count===1?'One conversation added to Messages.':count+' conversations added to Messages.');
 go('Inbox');
}
function historyControls(root){
 const panel=element('section','history-picker');
 const range=field(panel,'Date range',historyRange,{tag:'select',options:historyRanges});
 range.addEventListener('change',()=>setHistoryRange(range.value));
 const actions=element('div','history-actions');
 if(historyMode){
  const help=element('p','','Select conversations to add to Messages. Open any row to read the full thread before deciding.');
  const add=button(pendingHistory.size?'Add '+pendingHistory.size+' to Messages':'Add to Messages',importSelectedHistory,'action primary');
  add.disabled=!pendingHistory.size;
  actions.append(add,button('Cancel selection',()=>{historyMode=false;pendingHistory.clear();render()},'action secondary'));
  panel.append(help);
 }else actions.append(button('Select threads to add',()=>{historyMode=true;render()},'action secondary'));
 panel.append(actions);root.append(panel);
}
function historyRow(t){
 const wrap=element('div','mail-list-row');
 const pick=element('label','history-select');
 if(follows(t))pick.append(element('span','','Following'));
 else{
  const input=element('input');input.type='checkbox';input.checked=pendingHistory.has(t.id);
  input.setAttribute('aria-label','Select '+t.subject);
  input.addEventListener('change',()=>{
   if(input.checked)pendingHistory.add(t.id);else pendingHistory.delete(t.id);
   const add=main.querySelector('.history-actions .primary');
   add.disabled=!pendingHistory.size;
   add.textContent=pendingHistory.size?'Add '+pendingHistory.size+' to Messages':'Add to Messages';
  });
  pick.append(input);
 }
 wrap.append(entry(t,()=>open(t)),pick);return wrap;
}
function saveFollows(){
 try{localStorage.setItem(trackedKey,JSON.stringify({threads:[...followedThreads],people:[...followedPeople],excluded:[...excludedThreads]}))}catch{}
}
function personFor(t){
 if(!t)return '';
 return (t.recipientEmail||contacts.get(t.name)?.email||(!hasLiveGmail?address(t.name):'')).toLowerCase();
}
function follows(t){return !excludedThreads.has(t.id)&&(followedThreads.has(t.id)||followedPeople.has(personFor(t)))}
function toggleFollow(t){
 if(follows(t)){followedThreads.delete(t.id);if(followedPeople.has(personFor(t)))excludedThreads.add(t.id);toast('Conversation unfollowed. You can still find it in All mail.')}
 else{excludedThreads.delete(t.id);followedThreads.add(t.id);toast('Conversation followed. New replies will appear in Messages.')}
 saveFollows();render();
}
function togglePerson(email){
 const addr=email.toLowerCase();
 if(followedPeople.has(addr)){followedPeople.delete(addr);toast('Stopped following this person. Individually followed threads stay in Messages.')}
 else{
  followedPeople.add(addr);
  for(const t of mail.values())if(personFor(t)===addr)excludedThreads.delete(t.id);
  toast('Person followed. Their conversations will appear in Messages.');
 }
 saveFollows();render();
 if(hasLiveGmail&&typeof refreshFollowed==='function')refreshFollowed();
}
function mailRow(t,showFollow){
 if(!showFollow)return entry(t,()=>open(t));
 const wrap=element('div','mail-list-row'),control=button(follows(t)?'Following':'Follow',()=>toggleFollow(t),'follow-toggle');
 control.setAttribute('aria-label',(follows(t)?'Unfollow ':'Follow ')+t.subject);
 control.setAttribute('aria-pressed',String(follows(t)));
 wrap.append(entry(t,()=>open(t)),control);return wrap;
}

function actionMenu(actions){
 const menu=element('details','main-menu'),toggle=element('summary','menu-toggle');
 toggle.setAttribute('aria-label','Open page actions');
 const icon=element('span','menu-glyph');icon.setAttribute('aria-hidden','true');toggle.append(icon);
 const panel=element('div','menu-panel');panel.setAttribute('role','group');panel.setAttribute('aria-label','Page actions');
 panel.append(element('p','menu-heading','Actions'));
 for(const [label,action] of actions)panel.append(button(label,()=>{menu.open=false;action()},'menu-item'));
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;toggle.focus()}});
 menu.append(toggle,panel);return menu;
}
document.addEventListener('pointerdown',event=>{
 const menu=document.querySelector('.main-menu[open]');
 if(menu&&!menu.contains(event.target))menu.open=false;
});

function renderMailList(view,top,note){
 const all=view==='All mail';
 const controls=[['Search',()=>go('Search')],['Compose email',()=>go('New email')],['Trash',()=>go('Trash')]];
 if(hasLiveGmail)controls.push(['Refresh',()=>all?loadAllMail({reset:true}):refreshFollowed({refreshInbox:true})]);
 if(!all)controls.push(['Activity',()=>go('Notifications')],['Add from history',startHistory],[unreadOnly?'Show all followed':'Unread only',()=>{unreadOnly=!unreadOnly;render()}]);
 top.append(actionMenu(controls));
 if(note)notice(main,note);
 if(all)historyControls(main);
 const loading=hasLiveGmail&&(all?allMailLoading:liveLoading||followLoading);
 const error=hasLiveGmail&&(all?allMailError:liveError||followError);
 if(error)notice(main,error);
 if(all&&hasLiveGmail&&!allMailStarted&&!liveLoading){loadAllMail();}
 const pool=all?allMailRows():visibleMail();
 const rows=all||!unreadOnly?pool:pool.filter(t=>t.unread);
 if(!rows.length){
  const empty=element('section','follow-empty');
  const title=loading?'Loading Gmail…':all?'No mail to show':unreadOnly?'You’re caught up':'Follow conversations to see them here';
  empty.append(element('h2','',title));
  if(!all&&!loading){
   empty.append(element('p','',unreadOnly?'New replies to followed conversations will appear here.':'Open All mail and follow a thread, or open a contact and follow that person.'),button('Browse all mail',()=>go('All mail'),'action primary'));
  }
  main.append(empty);
 }
 rows.forEach(t=>main.append(all&&historyMode?historyRow(t):mailRow(t,all)));
 if(all&&hasLiveGmail&&allMailHasMore())main.append(button(loading?'Loading…':'Load more',()=>loadAllMail(),'action'));
}
function allMailRows(){
 const items=hasLiveGmail?[...allMailIds].map(id=>mail.get(id)).filter(Boolean):[...mail.values()];
 const cutoff=new Date('2026-11-17T00:00:00-05:00').getTime()-180*86400000;
 return items.filter(t=>!hidden.has(t.id)&&!trash.has(t.id)&&(
  hasLiveGmail||historyRange==='All dates'||(historyRange==='Last 180 days'?activity(t)>=cutoff:activity(t)<cutoff)
 )).sort((a,b)=>activity(b)-activity(a));
}
`;

function replace(text,before,after){
 if(!text.includes(before))throw Error("Missing followed-inbox anchor: "+before.slice(0,100));
 return text.replace(before,()=>after);
}

import { applyContactMessages } from './contact-messages.mjs';

export function applyFollowedInbox(source,{live=false}={}){
 const start=source.indexOf("<script>")+8,end=source.lastIndexOf("</script>");
 let js=source.slice(start,end);
 const put=(a,b)=>{js=replace(js,a,b)};
 put("const navItems=['Inbox','Contacts','Campaigns','Calendar','Settings'];", "const navItems=['Inbox','All mail','Contacts','Campaigns','Calendar','Settings'];\nconst hasLiveGmail="+live+";\n"+tracking);
 put("function visibleMail(){return [...mail.values()].filter(t=>!hidden.has(t.id)&&!trash.has(t.id)&&(!t.archive||imports.has(t.id))&&(!t.campaign||t.messages.length>1)).sort((a,b)=>activity(b)-activity(a))}", "function visibleMail(){return [...mail.values()].filter(t=>!hidden.has(t.id)&&!trash.has(t.id)&&follows(t)).sort((a,b)=>activity(b)-activity(a))}");
 const a=js.indexOf(" if(view==='Inbox'){"),b=js.indexOf(" if(view==='Campaigns'){",a);
 if(a<0||b<a)throw Error("Mail list route not found");
 js=js.slice(0,a)+" if(view==='Inbox'||view==='All mail'){renderMailList(view,top,note);return;}\n"+js.slice(b);
 put("if(view===state.view)b.setAttribute('aria-current','page');","if(view===state.view||view===state.home&&!navItems.includes(state.view))b.setAttribute('aria-current','page');");
 const heading=live?"view==='Inbox'?'Gmail':view==='Campaign folder'":"view==='Inbox'?'Gmail and Outlook':view==='Campaign folder'";
 put(heading,"view==='Inbox'?'People and conversations you follow':view==='All mail'?'Browse mail across your connected accounts':view==='Campaign folder'");
 put("if(!preview)toolbar(header,[['Thread options',()=>go('Thread options',t.id)],['Contact',()=>go('Contact profile',t.name)]]);","if(!preview){\n  const actions=[[follows(t)?'Unfollow thread':'Follow thread',()=>toggleFollow(t)],['Thread options',()=>go('Thread options',t.id)],['Contact',()=>go('Contact profile',t.name)]];\n  if(personFor(t))actions.unshift([followedPeople.has(personFor(t))?'Unfollow '+t.name:'Follow '+t.name,()=>togglePerson(personFor(t))]);\n  header.querySelector('.top').append(actionMenu(actions));\n }");
 put("box.append(button('Compose email',()=>go('New email',c.name),'action primary')","box.append(button(followedPeople.has(c.email.toLowerCase())?'Unfollow contact':'Follow contact',()=>togglePerson(c.email)),button('Compose email',()=>go('New email',c.name),'action primary')");
 put(":visibleMail()).forEach(m=>list.append(entry(m,()=>open(m))));",":state.home==='All mail'?allMailRows():visibleMail()).forEach(m=>list.append(mailRow(m,state.home==='All mail')));");
 put("const rail=element('aside','desktop-list'), title=element('h2','',t.campaign?t.subject:'Messages');","const rail=element('aside','desktop-list'), title=element('h2','',t.campaign?t.subject:state.home==='All mail'?'All mail':'Messages');");
 if(live)js=wireLiveTracking(js);
 else put("for(const id of deletedThreads)",`const handoff=mail.get('history-studio');
 if(handoff)handoff.messages.push(
  sample('Morgan Lane','Hi Maya, thanks for the walkthrough notes. Could you send the dates for the equipment delivery when you have them?','Aug 31 · 10:10 AM',{out:true}),
  sample('Maya Chen','Hi Morgan,\\n\\nTheo confirmed delivery for September 15 between 9:00 and 11:00 AM. I’ll bring the final run of show to our next meeting. Let me know if you’d like me to send it first.\\n\\nBest, Maya','Sep 1 · 11:35 AM')
 );
 add('history-march','Jordan Lee','March portfolio follow-up','outlook',[
  sample('Jordan Lee','Hi Morgan,\\n\\nThank you for sharing your work. I’d like to keep in touch about future design openings. Let me know if your availability changes.\\n\\nBest, Jordan','Mar 25 · 9:30 AM'),
  sample('Morgan Lane','Thanks, Jordan. I’d be glad to stay in touch and will send any updates.','Mar 26 · 10:20 AM',{out:true}),
  sample('Jordan Lee','That sounds good. I’ll follow up when the next role opens.','Mar 27 · 1:00 PM')
 ],{archive:true});
 for(const id of deletedThreads)`);
 js=js.replace("a{cursor:default}","a{cursor:default}table{max-width:100%}td,th,a,pre,code{overflow-wrap:anywhere;white-space:pre-wrap}");
 return applyContactMessages(source.slice(0,start).replace('</style>',listCss+mobileWrapping+'</style>')+js+source.slice(end),{live});
}

const liveTracking = `
let allMailStarted=false,allMailLoading=false,allMailError='',allMailGeneration=0,followLoading=false,followError='',followGeneration=0;
const allMailIds=new Set(),allMailCursors=new Map();
function resetAllMail(){allMailGeneration++;allMailStarted=false;allMailLoading=false;allMailError="";allMailIds.clear();allMailCursors.clear()}
function allMailHasMore(){return !allMailLoading&&activeAccounts().some(a=>allMailCursors.get(a.id)!==null)}
async function loadAllMail({reset=false}={}){
 if(allMailLoading&&!reset)return;
 const id=++allMailGeneration;
 if(reset){allMailIds.clear();allMailCursors.clear()}
 allMailStarted=true;allMailLoading=true;allMailError='';
 if(state.view==='All mail')render();
 const accounts=activeAccounts().filter(a=>allMailCursors.get(a.id)!==null);
 const pages=await Promise.allSettled(accounts.map(a=>{
  const params=new URLSearchParams({account:a.id,range:historyRange==='Last 180 days'?'recent':historyRange==='Older than 180 days'?'older':'all'});
  const cursor=allMailCursors.get(a.id);if(cursor)params.set('cursor',cursor);
  return liveApi('all-mail?'+params).then(data=>({a,data}));
 }));
 if(id!==allMailGeneration)return;
 for(const page of pages){
  if(page.status==='rejected'){allMailError='A Gmail mailbox could not load. Refresh to try again.';continue}
  const {a,data}=page.value;allMailCursors.set(a.id,data.nextCursor||null);
  for(const m of data.messages){const t=liveUpsert(m,false);if(t)allMailIds.add(t.id)}
 }
 allMailLoading=false;
 if(state.view==='All mail')render();
}
function groups(items,size){
 const batches=[];for(let i=0;i<items.length;i+=size)batches.push(items.slice(i,i+size));return batches;
}
async function refreshFollowed({refreshInbox=false}={}){
 const token=++followGeneration;
 if(!activeAccounts().length)return;
 followLoading=true;followError='';
 if(refreshInbox&&state.view==='Inbox')render();
 const jobs=[];
 for(const a of activeAccounts()){
  const prefix=a.id+':';
  const ids=[...followedThreads].filter(id=>id.startsWith(prefix)&&!deletedThreads.has(id)).map(id=>id.slice(prefix.length));
  for(const batch of groups(ids,20))jobs.push(liveApi('followed-mail',{accountId:a.id,threadIds:batch,people:[]}));
  for(const batch of groups([...followedPeople],8))jobs.push(liveApi('followed-mail',{accountId:a.id,threadIds:[],people:batch}));
 }
 const responses=await Promise.allSettled(jobs);
 if(token!==followGeneration)return;
 for(const result of responses){
  if(result.status==='rejected'){followError='Some followed Gmail conversations could not refresh.';continue}
  for(const m of result.value.messages)liveUpsert(m,false);
 }
 followLoading=false;
 if(state.view==='Inbox')render();
}
`;
function wireLiveTracking(js){
 const put=(a,b)=>{js=replace(js,a,b)};
 put("if(all&&hasLiveGmail&&!allMailStarted&&!liveLoading){loadAllMail();}","if(all&&hasLiveGmail&&!allMailStarted&&!liveLoading){queueMicrotask(()=>{if(!allMailStarted&&state.view==='All mail')loadAllMail()});}");
 put("['Inbox','Integrations','Sync status'].includes(state.view)", "['Inbox','All mail','Integrations','Sync status'].includes(state.view)");
 put("liveRestoreCampaigns();}","liveRestoreCampaigns();refreshFollowed();}");
 put("setInterval(()=>{if(state.view==='Inbox'&&document.visibilityState==='visible'&&!liveLoading)liveRefresh()},45000);","setInterval(()=>{if(state.view==='Inbox'&&document.visibilityState==='visible'&&!followLoading)refreshFollowed()},45000);");
 put("bootLive();",liveTracking+"\nbootLive();");
 return js;
}
