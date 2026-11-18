import { b64, unb64, digest, configuration, tokenExchange, mailboxIdentity, listMail, fullThread, sendReply, ccList, emailList, sendOptions, sendGmail, getGmailAttachment, gmailMailPage, gmailFollowed, gmailContactPage, ReplyTargetError } from "./lib/mail.mjs";

const enc = new TextEncoder();
const dec = new TextDecoder();
const sessionName = "__Host-mailthread";
const oauthName = "__Host-mailthread-oauth";
const hours = 12 * 3600;
const authHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

const json = (data, status = 200, more = {}) => Response.json(data, { status, headers: { ...authHeaders, ...more } });
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const readCookie = (req, name) => req.headers.get("Cookie")?.split(/;\s*/).find(c => c.startsWith(name + "="))?.slice(name.length + 1) || "";
const cookie = (name, value, seconds) => name + "=" + value + "; Path=/; Max-Age=" + seconds + "; Secure; HttpOnly; SameSite=Lax";
const redirect = (location, headers = {}) => new Response(null, { status: 303, headers: { ...authHeaders, Location: location, ...headers } });

async function seal(env, data) {
  const key = await crypto.subtle.importKey("raw", await digest(env.MAILTHREAD_ENCRYPTION_KEY), "AES-GCM", false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const body = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv:nonce }, key, enc.encode(JSON.stringify(data))));
  return b64(nonce) + "." + b64(body);
}
async function unseal(env, value) {
  if (!value || !env.MAILTHREAD_ENCRYPTION_KEY) return null;
  try {
    const [nonce, data] = value.split(".");
    const key = await crypto.subtle.importKey("raw", await digest(env.MAILTHREAD_ENCRYPTION_KEY), "AES-GCM", false, ["decrypt"]);
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name:"AES-GCM", iv:unb64(nonce) }, key, unb64(data))));
  } catch { return null; }
}
async function equal(a, b) {
  const [x,y] = await Promise.all([digest(a),digest(b)]);
  let mismatch = 0;
  for (let i = 0; i < x.length; i++) mismatch |= x[i] ^ y[i];
  return mismatch === 0;
}
const configured = env => !!(env.MAILTHREAD_STORE && env.MAILTHREAD_ENCRYPTION_KEY?.length >= 32 && env.MAILTHREAD_ACCESS_KEY?.length >= 24);
const accountKey = id => "account:" + id;
const accountIdValid = id => typeof id === "string" && /^[A-Za-z0-9_-]{43}$/.test(id);
const readAccount = (env, id) => accountIdValid(id) ? env.MAILTHREAD_STORE.get(accountKey(id), "json") : null;

async function getAccounts(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.MAILTHREAD_STORE.list({ prefix:"account:", limit:100, cursor });
    const records = await Promise.all(page.keys.map(k => env.MAILTHREAD_STORE.get(k.name, "json")));
    out.push(...records.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

async function accessToken(env, account) {
  const secrets = await unseal(env, account.tokens);
  if (!secrets) throw new Error("Reconnect this mailbox.");
  if (secrets.expires > Date.now() + 60000) return secrets.access;
  const settings = configuration(env, account.provider);
  if (!settings || !secrets.refresh) throw new Error("Reconnect this mailbox.");
  const next = await tokenExchange(settings, { grant_type:"refresh_token", refresh_token:secrets.refresh });
  const tokens = await seal(env, { access:next.access_token, refresh:next.refresh_token || secrets.refresh, expires:Date.now()+next.expires_in*1000 });
  await env.MAILTHREAD_STORE.put(accountKey(account.id), JSON.stringify({ ...account, tokens }));
  return next.access_token;
}

async function api(req, env, url) {
  const method = req.method;
  const path = url.pathname.split("/").filter(Boolean).slice(1);
  const action = path[0];
  const session = await unseal(env, readCookie(req, sessionName));
  const authenticated = configured(env) && session?.type === "session" && session.expires > Date.now();
  if (action === "status" && method === "GET") return json({
    configured: configured(env), authenticated: !!authenticated,
    gmail: !!configuration(env,"gmail"), outlook: !!configuration(env,"outlook"),
    application: "mailthread", launch: env.ASSETS || env.NEXT_EXPORT_VERSION ? "next" : "worker",
  });
  if (method !== "GET" && (method !== "POST" || req.headers.get("Origin") !== url.origin)) return json({ error:"Invalid request origin or method." }, 403);
  if (action === "session" && method === "POST") {
    if (!configured(env)) return json({ error:"Set up Mailthread on the server first." }, 503);
    const { password } = await req.json();
    if (typeof password !== "string" || password.length > 512 || !await equal(password, env.MAILTHREAD_ACCESS_KEY)) return json({ error:"Invalid access key." }, 401);
    const value = await seal(env, { type:"session", id:random(), expires:Date.now()+hours*1000 });
    return json({ ok:true }, 200, { "Set-Cookie":cookie(sessionName,value,hours) });
  }
  if (action === "logout" && method === "POST") return json({ ok:true }, 200, { "Set-Cookie":cookie(sessionName,"",0) });
  if (!authenticated) return json({ error:"Unlock Mailthread first." }, 401);
  const provider = path[1];
  if (action === "connect" && method === "GET") {
    const config = configuration(env, provider);
    if (!config) return json({ error:"Set up this provider's OAuth client first." }, 503);
    const state = random(), verifier = random();
    const data = await seal(env,{ type:"oauth", state, provider, verifier, sid:session.id, expires:Date.now()+600000 });
    const client = new URL(config.authorize);
    client.search = new URLSearchParams({
      client_id:config.id, response_type:"code", redirect_uri:url.origin+"/api/callback/"+provider,
      scope:config.scope, state, code_challenge:b64(await digest(verifier)), code_challenge_method:"S256", ...config.extras,
    });
    return redirect(client.toString(),{ "Set-Cookie":cookie(oauthName,data,600) });
  }
  if (action === "callback" && method === "GET") {
    const flow = await unseal(env, readCookie(req,oauthName)), config = configuration(env,provider);
    const clear = { "Set-Cookie":cookie(oauthName,"",0) };
    if (!config || !flow || flow.type !== "oauth" || flow.sid !== session.id || flow.provider !== provider || flow.expires < Date.now() || flow.state !== url.searchParams.get("state") || !url.searchParams.get("code")) {
      return redirect("/?connection=failed",clear);
    }
    const response = await tokenExchange(config,{
      code:url.searchParams.get("code"), code_verifier:flow.verifier, grant_type:"authorization_code",
      redirect_uri:url.origin+"/api/callback/"+provider,
    });
    const email = await mailboxIdentity(provider,response.access_token);
    if (!email || !response.refresh_token) return redirect("/?connection=failed", clear);
    const id = b64(await digest(provider + ":" + email.toLowerCase()));
    const tokens = await seal(env,{ access:response.access_token, refresh:response.refresh_token, expires:Date.now()+response.expires_in*1000 });
    await env.MAILTHREAD_STORE.put(accountKey(id),JSON.stringify({ id, provider, email, tokens }));
    return redirect("/?connection=success",clear);
  }
  if (action === "accounts" && method === "GET") return json({ accounts:(await getAccounts(env)).map(({id,provider,email}) => ({id,provider,email})) });
  if (action === "disconnect" && method === "POST") {
    const { accountId } = await req.json();
    if (!accountIdValid(accountId)) return json({ error:"Invalid mailbox." }, 400);
    await env.MAILTHREAD_STORE.delete(accountKey(accountId));
    return json({ ok:true });
  }

  const assignMailbox=(account,items)=>items.map(item=>({...item,accountId:account.id,mailbox:account.email,provider:account.provider}));
  if(action==="all-mail"&&method==="GET"){
    const account=await readAccount(env,url.searchParams.get("account"));
    const cursor=url.searchParams.get("cursor");
    if(account?.provider!=="gmail"||(cursor&&cursor.length>1000))return json({error:"Invalid Gmail mailbox or page."},400);
    const range=url.searchParams.get("range")||"all";
    if(!["all","recent","older"].includes(range))return json({error:"Invalid Gmail date range."},400);
    const cutoff=Math.floor((Date.now()-180*86400000)/1000);
    const q=(range==="recent"?"after:"+cutoff+" ":range==="older"?"before:"+cutoff+" ":"")+"-in:spam -in:trash -in:drafts";
    const page=await gmailMailPage(account,await accessToken(env,account),{cursor,q});
    return json({messages:assignMailbox(account,page.messages),nextCursor:page.nextCursor});
  }

  if(action==="contact-mail"&&method==="GET"){
    const account=await readAccount(env,url.searchParams.get("account"));
    const contact=(url.searchParams.get("email")||"").toLowerCase(),mode=url.searchParams.get("mode")||"direct",cursor=url.searchParams.get("cursor");
    if(account?.provider!=="gmail"||contact.length>254||!/^[a-z0-9.!%+_-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(contact)||
      !["direct","all"].includes(mode)||(cursor&&cursor.length>1000))return json({error:"Invalid contact or mailbox."},400);
    const page=await gmailContactPage(account,await accessToken(env,account),{contact,mode,cursor});
    return json({messages:assignMailbox(account,page.messages),nextCursor:page.nextCursor});
  }

  if(action==="followed-mail"&&method==="POST"){
    const {accountId,threadIds,people}=await req.json();
    const account=await readAccount(env,accountId);
    if(account?.provider!=="gmail"||!Array.isArray(threadIds)||threadIds.length>20||threadIds.some(id=>typeof id!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(id))||
      !Array.isArray(people)||people.length>8||people.some(email=>typeof email!=="string"||email.length>254||!/^[A-Za-z0-9.!%+_-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)))
      return json({error:"Invalid followed Gmail conversations."},400);
    return json({messages:assignMailbox(account,await gmailFollowed(account,await accessToken(env,account),threadIds,people))});
  }

  if (action === "mail" && method === "GET") {
    const accounts = await getAccounts(env);
    const search = url.searchParams.get("q") || "";
    const replies = await Promise.allSettled(accounts.map(async account => {
      const token = await accessToken(env,account);
      const items = await listMail(account, token, search, Math.max(1, Math.min(15, Math.floor(30 / accounts.length))));
      return items.map(item => ({ ...item, accountId:account.id, mailbox:account.email, provider:account.provider }));
    }));
    const messages = replies.flatMap(result => result.status === "fulfilled" ? result.value : []);
    return json({ messages:messages.sort((a,b)=>b.date.localeCompare(a.date)), unavailable:replies.filter(r=>r.status==="rejected").length });
  }
  if (action === "thread" && method === "GET") {
    const account = await readAccount(env,url.searchParams.get("account"));
    const id = url.searchParams.get("id");
    if (!account || !id || id.length > 600) return json({ error:"Conversation not found." },404);
    const messages = await fullThread(account,await accessToken(env,account),id);
    return json({ messages:messages.map(({id,from,replyTo,date,body,subject,to,cc,attachments})=>({id,from,replyTo,date,body,subject,to,cc,attachments})) });
  }

  if (action === "send" && method === "POST") {
    const data = await req.json(), account = await readAccount(env,data.accountId);
    if (!account || account.provider !== "gmail" || typeof data.body !== "string" || data.body.length > 100000 ||
      typeof data.subject !== "string" || data.subject.length > 500) return json({error:"Invalid Gmail message."},400);
    let to,cc,bcc,options;
    try { to=emailList(data.to,true);cc=emailList(data.cc||[]);bcc=emailList(data.bcc||[]);options=sendOptions(data); }
    catch (error) { return json({error:error.message},400); }
    const sent=await sendGmail(account,await accessToken(env,account),{to,cc,bcc,subject:data.subject,body:data.body,...options});
    return json({ok:true,threadId:sent.threadId,id:sent.id});
  }
  if(action==="attachment"&&method==="GET"){
    const account=await readAccount(env,url.searchParams.get("account")),message=url.searchParams.get("message"),id=url.searchParams.get("id");
    if(!account||account.provider!=="gmail"||!message||!id||message.length>250||id.length>4000) return json({error:"Attachment not found."},404);
    const bytes=await getGmailAttachment(await accessToken(env,account),message,id);
    const filename=encodeURIComponent((url.searchParams.get("name")||"attachment").slice(0,230)).replace(/'/g,"%27");
    return new Response(bytes,{headers:{...authHeaders,"Content-Type":"application/octet-stream","Content-Disposition":"attachment; filename*=UTF-8''"+filename}});
  }

  if (action === "reply" && method === "POST") {
    const data = await req.json();
    const { accountId, threadId, body, cc, targetMessageId } = data;
    const account = await readAccount(env,accountId);
    if (!account || typeof threadId !== "string" || !threadId || threadId.length > 600 || typeof body !== "string" || (!body.trim()&&!data.html) || body.length > 100000) return json({ error:"Invalid email reply." },400);
    let recipients,options;
    try { recipients=ccList(cc);options=sendOptions(data); } catch (error) { return json({error:error.message},400); }
    if(targetMessageId!==undefined&&(typeof targetMessageId!=="string"||!/^[A-Za-z0-9_-]{1,250}$/.test(targetMessageId)))return json({error:"Invalid reply target."},400);
    try { await sendReply(account,await accessToken(env,account),threadId,body.trim(),recipients,options,targetMessageId); }
    catch(error){if(error instanceof ReplyTargetError)return json({error:error.message},400);throw error;}
    return json({ ok:true });
  }
  return json({ error:"Unknown Mailthread endpoint." },404);
}

const fallback = "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\"><meta name=\"referrer\" content=\"no-referrer\"><title>Mailthread</title>\n<style>\n*{box-sizing:border-box}body{margin:0;background:#eef3fa;color:#172842;font:16px/1.55 system-ui,sans-serif}main{max-width:650px;margin:auto;min-height:100dvh;background:#fff;padding:22px clamp(18px,5vw,36px)}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e0e8f4;padding:0 0 14px;gap:10px}.brand{color:#1555bc;font-weight:800;font-size:18px}.muted,small{color:#536780}h1{font-size:29px;margin:16px 0 6px;letter-spacing:-.035em}h2{font-size:17px}.banner{background:#eaf2ff;padding:10px 13px;border-radius:10px;color:#284c79}.actions{display:flex;gap:9px;flex-wrap:wrap;margin:10px 0}.action,button{display:inline-flex;align-items:center;min-height:44px;border:0;border-radius:9px;padding:9px 13px;text-decoration:none;background:#e6efff;color:#164681;font:650 14px system-ui;cursor:pointer}.primary{background:#1658cc;color:#fff}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #8ab2ff;outline-offset:3px}label{display:grid;gap:5px;font-weight:650;margin-bottom:10px}input{min-height:44px;border:1px solid #bbcae0;border-radius:9px;padding:8px;font:inherit;color:inherit}ul{padding-left:22px}.row{padding:12px 0;border-bottom:1px solid #e0e8f4;display:grid;gap:3px}.row button{justify-self:start}.status{min-height:22px;color:#4a627e}code{overflow-wrap:anywhere;font-size:13px}.foot{margin-top:18px}\n\nnav{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}nav button{min-height:40px;padding-inline:10px}nav [aria-current=page]{background:#1658cc;color:white}button[disabled]{opacity:.55;cursor:default}\nmain{max-width:800px}.toolbar{display:flex;gap:7px;flex-wrap:wrap;align-items:end;margin:12px 0}.toolbar label{flex:1 1 200px;margin:0}.message{display:grid;text-align:left;gap:3px;width:100%;background:#fff;color:#192a43;border-bottom:1px solid #e0e8f4;border-radius:0;padding:12px 4px;white-space:normal}.message:hover{background:#f3f7fd}.message strong,.message span,.message small{overflow-wrap:anywhere}.message small{font-weight:500}.message span{font-weight:400}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#1662e4;margin-right:8px}\n.email{padding:14px 15px;margin:12px 0;border:1px solid #e0e8f4;border-radius:12px}.email p{white-space:pre-wrap;overflow-wrap:anywhere;margin:9px 0 0}.email small{display:block}.reply{margin-top:14px;background:#f5f8fd;border:1px solid #e0e8f4;border-radius:12px;padding:12px}.reply textarea{width:100%;min-height:112px;border:1px solid #bbcae0;border-radius:9px;padding:9px;font:inherit;resize:vertical}.reply label[hidden]{display:none}.right{display:flex;align-items:center;justify-content:space-between;gap:8px}.subject{overflow-wrap:anywhere}.tag{display:inline-block;font-size:12px;background:#eaf2ff;color:#174989;padding:3px 7px;border-radius:14px}\n</style></head>\n<body><main><header><span class=\"brand\">Mailthread</span><nav id=\"nav\" aria-label=\"Mailthread navigation\"></nav></header><div id=\"status\" class=\"status\" role=\"status\"></div><section id=\"panel\" aria-label=\"Mailbox controls\"></section></main>\n<script>\n(() => {\nconst panel=document.getElementById('panel'), status=document.getElementById('status'), nav=document.getElementById('nav');\nlet session=null,active='messages',query='',thread=null,seq=0,mail=[];\nconst readKey='mailthread.live.read.v1';\nlet read={};\ntry { read=JSON.parse(localStorage.getItem(readKey)||'{}')||{}; } catch {}\nconst el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e};\nconst link=(label,href,cls='action')=>{const a=el('a',label,cls);a.href=href;return a};\nconst button=(label,action,cls)=>{const b=el('button',label,cls);b.type='button';b.addEventListener('click',action);return b};\nconst line=(tag,text,cls)=>panel.append(el(tag,text,cls));\nasync function api(path,body){\n const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});\n const parsed=await r.json();\n if(r.status===401&&path!=='session'){session={...session,authenticated:false};render();throw Error('Unlock Mailthread again.')}\n if(!r.ok)throw Error(parsed.error||'Request failed');\n return parsed;\n}\nfunction showError(error){status.textContent=error.message||'Mailthread is unavailable.'}\nconst run=f=>async(event)=>{try{await f(event)}catch(e){showError(e)}};\nconst params=new URLSearchParams(location.search);\nif(params.has('connection')){\n active='accounts';status.textContent=params.get('connection')==='success'?'Gmail account connected.':'Authorization was incomplete. Try connecting again.';\n history.replaceState(null,'','/');\n}\nfunction choose(view){active=view;thread=null;status.textContent='';render()}\nfunction drawNav(){\n nav.replaceChildren();\n if(session?.authenticated){\n  for(const [id,label] of [['messages','Messages'],['accounts','Mailboxes']]){\n   const b=button(label,()=>choose(id));if(active===id)b.setAttribute('aria-current','page');nav.append(b);\n  }\n } else nav.append(link('Demo','/demo/'));\n}\nfunction render(){\n seq++;drawNav();panel.replaceChildren();\n if(!session?.configured){\n  line('h1','Mailthread');line('p','Mailbox sign-in is waiting for the owner to configure the Worker.','banner');\n  panel.append(link('Open sample-data demo','/demo/'));return;\n }\n if(!session.authenticated){\n  line('h1','Unlock Mailthread');line('p','Use your Mailthread access key to open your Gmail inbox.','muted');\n  const form=el('form'),label=el('label','Mailthread access key'),input=el('input');input.type='password';input.required=true;input.autocomplete='current-password';\n  label.append(input);const submit=el('button','Unlock Mailthread','primary');submit.type='submit';form.append(label,submit);panel.append(form);\n  form.addEventListener('submit',run(async event=>{\n   event.preventDefault();submit.disabled=true;const password=input.value;input.value='';\n   try{await api('session',{password});session=await api('status');status.textContent='';render()}finally{submit.disabled=false}\n  }));return;\n }\n if(active==='accounts'){showAccounts();return;}\n if(thread){showThread();return;}\n showInbox();\n}\nfunction showAccounts(){\n const stamp=seq;\n line('h1','Mailboxes');line('p','Connect each Gmail address separately.','muted');\n const actions=el('div','','actions'),list=el('div');panel.append(actions,list);\n if(session.gmail)actions.append(link('Add Gmail account','/api/connect/gmail','action primary'));\n else line('p','Gmail OAuth credentials are missing.','banner');\n actions.append(button('Sign out',run(async()=>{await api('logout',{});session=await api('status');mail=[];query='';thread=null;status.textContent='Signed out.';render()})));\n actions.append(link('Open sample-data demo','/demo/'));\n run(async()=>{\n  const {accounts}=await api('accounts');if(stamp!==seq)return;\n  if(!accounts.some(a=>a.provider==='gmail'))list.append(el('p','No Gmail addresses connected yet.','muted'));\n  for(const a of accounts.filter(a=>a.provider==='gmail')){\n   const row=el('div','','row');row.append(el('strong',a.email),el('small','Gmail'),\n    button('Disconnect',run(async()=>{if(!confirm('Disconnect '+a.email+' from Mailthread?'))return;await api('disconnect',{accountId:a.id});mail=[];status.textContent='Mailbox disconnected.';render()})));\n   list.append(row);\n  }\n })();\n}\nconst localId=m=>m.accountId+':'+m.threadId;\nfunction unread(m){return m.unread&&read[localId(m)]!==m.revision}\nfunction markRead(m){\n read[localId(m)]=m.revision;\n const entries=Object.entries(read).slice(-750);read=Object.fromEntries(entries);\n try{localStorage.setItem(readKey,JSON.stringify(read));}catch{}\n}\nfunction listInto(list){\n list.replaceChildren();\n if(!mail.length){list.append(el('p',query?'No conversations match this search.':'No recent conversations. Open Mailboxes to check your Gmail connection.','muted'));return}\n for(const m of mail){\n  const item=button('',run(async()=>{\n   const request=++seq;status.textContent='Opening conversation…';\n   const data=await api('thread?account='+encodeURIComponent(m.accountId)+'&id='+encodeURIComponent(m.threadId));\n   if(request!==seq)return;\n   markRead(m);thread={...m,messages:data.messages};status.textContent='';render();\n  }),'message');\n  const subject=el('strong',m.subject);if(unread(m)){const dot=el('span','','dot');dot.setAttribute('aria-label','Unread');subject.prepend(dot)}\n  item.append(subject,el('small',(m.from||'Unknown sender')+' · '+m.mailbox),el('span',m.preview));\n  list.append(item);\n }\n}\nasync function loadMail(list,stamp,q){\n const data=await api('mail?q='+encodeURIComponent(q));\n if(stamp!==seq)return;\n mail=data.messages.filter(m=>m.provider==='gmail');listInto(list);\n status.textContent=data.unavailable?'A mailbox needs attention. Check Mailboxes.':'';\n}\nfunction showInbox(){\n line('h1','Messages');\n const form=el('form','','toolbar'), label=el('label','Search Gmail'),input=el('input');input.type='search';input.value=query;\n const search=el('button','Search','primary');search.type='submit';label.append(input);form.append(label,search);\n const list=el('section');list.setAttribute('aria-label','Gmail conversations');\n form.append(button('Refresh',run(async()=>{query='';input.value='';status.textContent='Refreshing…';await loadMail(list,++seq,'')})));\n form.addEventListener('submit',run(async event=>{event.preventDefault();query=input.value.trim();status.textContent='Searching…';await loadMail(list,++seq,query)}));\n panel.append(form,list);\n if(mail.length)listInto(list);else list.append(el('p','Loading Gmail…','muted'));\n run(()=>loadMail(list,seq,query))();\n}\nfunction showThread(){\n const current=thread;\n panel.append(button('‹ Messages',()=>choose('messages')));\n line('h1',current.subject,'subject');line('p',current.mailbox,'tag');\n for(const m of current.messages){\n  const article=el('article','','email'),time=m.date?new Date(m.date).toLocaleString():'';\n  article.append(el('strong',m.from||'Unknown sender'),el('small',time),el('p',m.body||'No text in this message.'));panel.append(article);\n }\n const form=el('form','','reply'),head=el('div','','right'),cc=el('input'),ccLabel=el('label','Cc'),label=el('label','Reply'),body=el('textarea');\n cc.type='email';cc.multiple=true;ccLabel.hidden=true;ccLabel.append(cc);\n const plus=button('+',()=>{ccLabel.hidden=!ccLabel.hidden;if(!ccLabel.hidden)cc.focus();else cc.value=''});plus.setAttribute('aria-label','Add a person to this reply');\n head.append(el('strong','Reply in this thread'),plus);body.required=true;label.append(body);\n const send=el('button','Send reply','primary');send.type='submit';\n form.append(head,ccLabel,label,send);panel.append(form);\n form.addEventListener('submit',run(async event=>{\n  event.preventDefault();const value=body.value.trim();if(!value||send.disabled)return;\n  send.disabled=true;status.textContent='Sending…';\n  try{\n   await api('reply',{accountId:current.accountId,threadId:current.threadId,body:value,cc:cc.value});\n   if(thread!==current)return;\n   current.messages.push({from:current.mailbox,date:new Date().toISOString(),body:value});\n   render();status.textContent='Reply sent.';\n  } finally{send.disabled=false}\n }));\n}\nrun(async()=>{session=await api('status');render()})();\nsetInterval(()=>{\n if(session?.authenticated&&active==='messages'&&!thread&&!query&&document.visibilityState==='visible'&&!status.textContent){\n  const list=panel.querySelector('[aria-label=\"Gmail conversations\"]');\n  if(list)run(()=>loadMail(list,++seq,''))();\n }\n},45000);\n})();\n</script></body></html>";

const nextAssetTypes = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
};

async function nextExport(request, env, pathname) {
  if (!env.NEXT_EXPORT_VERSION || !["GET", "HEAD"].includes(request.method)) return null;
  const file = pathname.endsWith("/") ? pathname + "index.html" : pathname;
  const type = nextAssetTypes[file.slice(file.lastIndexOf("."))];
  if (!type) return null;
  const stream = await env.MAILTHREAD_STORE.get("next-export:" + env.NEXT_EXPORT_VERSION + ":" + file, "stream");
  if (!stream) return null;
  const headers = { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Cache-Control": pathname.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache" };
  if (request.method === "HEAD") { await stream.cancel(); return new Response(null, { headers }); }
  return new Response(stream.pipeThrough(new DecompressionStream("gzip")), { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request,env,url);
      if (url.pathname === "/workspace" || url.pathname === "/workspace/" || url.pathname === "/workspace.html") {
        const session = await unseal(env,readCookie(request,sessionName));
        if (!configured(env) || session?.type !== "session" || session.expires < Date.now()) return redirect("/");
        const asset=env.ASSETS&&await env.ASSETS.fetch(new Request(url.origin+"/workspace.html"));
        const gzip=!asset?.ok&&env.NEXT_EXPORT_VERSION&&await env.MAILTHREAD_STORE.get("next-export:"+env.NEXT_EXPORT_VERSION+":/workspace.html","stream");
        const stream=asset?.ok?asset.body:gzip&&gzip.pipeThrough(new DecompressionStream("gzip"));
        if (!stream) return new Response("Workspace is temporarily unavailable.",{status:503,headers:authHeaders});
        return new Response(stream,{headers:{...authHeaders,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data: blob:; connect-src 'self' blob: data:; frame-src 'self' about:; form-action 'self'; base-uri 'none'; frame-ancestors 'self'"}});
      }
      if (url.pathname === "/demo" || url.pathname === "/demo/") {
        const versioned = env.NEXT_EXPORT_VERSION && await env.MAILTHREAD_STORE?.get("next-export:"+env.NEXT_EXPORT_VERSION+":/demo/index.html","stream");
        const gzip = versioned || await env.MAILTHREAD_STORE?.get("demo:html","stream");
        if (gzip) return new Response(gzip.pipeThrough(new DecompressionStream("gzip")), {
          headers:{ "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff",
            "Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data: blob:; frame-src 'self' about:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'" },
        });
      }
      if (env.ASSETS) return env.ASSETS.fetch(request);
      const exported = await nextExport(request, env, url.pathname);
      if (exported) return exported;
      if (url.pathname === "/" && request.method === "GET") return new Response(fallback,{ headers:{ "Content-Type":"text/html; charset=utf-8",...authHeaders, "Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" } });
      return new Response("Not found",{ status:404, headers:authHeaders });
    } catch {
      if (url.pathname.startsWith("/api/callback/")) return redirect("/?connection=failed",{ "Set-Cookie":cookie(oauthName,"",0) });
      return json({ error:"Mailthread could not complete that request. Check the mailbox connection and try again." },502);
    }
  },
};
