const google = "https://www.googleapis.com/gmail/v1/users/me";
const graph = "https://graph.microsoft.com/v1.0/me";
const microsoft = "https://login.microsoftonline.com/common/oauth2/v2.0";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function bytes64(bytes) {
  let output = "";
  for (let i = 0; i < bytes.length; i += 16000) output += String.fromCharCode(...bytes.subarray(i,i+16000));
  return btoa(output);
}
export const b64 = value => bytes64(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
export const unb64 = value => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
export async function digest(value) { return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }

export function configuration(env, provider) {
  if (provider === "gmail" && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) return {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token",
    id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET,
    scope: "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    extras: { access_type: "offline", prompt: "consent select_account" },
  };
  if (provider === "outlook" && env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) return {
    authorize: microsoft + "/authorize", token: microsoft + "/token",
    id: env.MICROSOFT_CLIENT_ID, secret: env.MICROSOFT_CLIENT_SECRET,
    scope: "offline_access User.Read Mail.ReadWrite Mail.Send",
    extras: { prompt: "select_account" },
  };
}

export async function tokenExchange(settings, values) {
  const response = await fetch(settings.token, {
    method: "POST", body: new URLSearchParams({ client_id: settings.id, client_secret: settings.secret, ...values }),
  });
  if (!response.ok) throw new Error("Mailbox authorization failed. Reconnect and try again.");
  return response.json();
}

async function providerRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options, headers: { Authorization: "Bearer " + token, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  if (!response.ok) throw new Error(response.status === 429 ? "Mailbox rate limit reached. Try again shortly." : "Mailbox request failed.");
  if (response.status === 204 || response.status === 202 && !response.headers.get("content-type")) return {};
  return response.json();
}

const header = (message, name) => message.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
const date = value => new Date(Number(value || 0)).toISOString();
const address = value => String(value || "").match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "";
const strip = value => value.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const email = value => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && !/[\r\n]/.test(value);
export function ccList(value) {
  const rows = String(value || "").split(",").map(s => s.trim()).filter(Boolean);
  if (rows.length > 20 || rows.some(s => !email(s))) throw new Error("Enter valid Cc email addresses separated by commas.");
  return [...new Set(rows)];
}
function mimeBody(payload) {
  const entries = [];
  const collect = part => {
    if (!part || part.filename) return;
    if (part.body?.data && ["text/plain","text/html"].includes(part.mimeType)) entries.push(part);
    for (const child of part.parts || []) collect(child);
  };
  collect(payload);
  const part = entries.find(p => p.mimeType === "text/plain") || entries[0];
  if (!part) return "";
  const body = decoder.decode(unb64(part.body.data));
  return part.mimeType === "text/html" ? strip(body) : body;
}

export async function mailboxIdentity(kind, token) {
  if (kind === "gmail") return (await providerRequest(google + "/profile", token)).emailAddress;
  const me = await providerRequest(graph + "?$select=mail,userPrincipalName", token);
  return me.mail || me.userPrincipalName;
}


async function gmailSummary(account,token,id) {
  const thread=await providerRequest(google+"/threads/"+encodeURIComponent(id)+"?format=metadata",token);
  const latest=thread.messages?.at(-1);
  if(!latest)return null;
  const isOwn=m=>address(header(m,"from")).toLowerCase()===account.email.toLowerCase();
  const latestIncoming=[...thread.messages].reverse().find(m=>!isOwn(m));
  return {
    threadId:thread.id,revision:latest.id,from:isOwn(latest)?(latestIncoming?header(latestIncoming,"from"):header(latest,"to")):header(latest,"from"),
    subject:header(latest,"subject")||"(No subject)",preview:strip(latest.snippet||""),date:date(latest.internalDate),
    unread:thread.messages.some(m=>m.labelIds?.includes("UNREAD")),
  };
}
export async function gmailMailPage(account,token,{q="-in:spam -in:trash -in:drafts",cursor,limit=15}={}) {
  const params=new URLSearchParams({q,maxResults:String(limit)});
  if(cursor)params.set("pageToken",cursor);
  const page=await providerRequest(google+"/threads?"+params,token);
  const messages=(await Promise.all((page.threads||[]).map(item=>gmailSummary(account,token,item.id)))).filter(Boolean);
  return {messages,nextCursor:page.nextPageToken||null};
}
export async function gmailFollowed(account,token,threadIds,people) {
  const messages=[];
  if(threadIds.length){
    const responses=await Promise.allSettled(threadIds.map(id=>gmailSummary(account,token,id)));
    for(const response of responses)if(response.status==="fulfilled"&&response.value)messages.push(response.value);
  }
  if(people.length){
    const q="{"+people.map(a=>"from:"+a+" to:"+a).join(" ")+"} -in:spam -in:trash -in:drafts";
    const page=await gmailMailPage(account,token,{q});messages.push(...page.messages);
  }
  return [...new Map(messages.map(m=>[m.threadId,m])).values()];
}

export async function listMail(account, token, search, limit = 15) {
  if (account.provider === "gmail") {
    const q = search ? String(search).slice(0, 180) + " -in:spam -in:trash" : "in:inbox newer_than:180d -in:spam -in:trash";
    return (await gmailMailPage(account,token,{q,limit})).messages;
  }
  const select = "id,conversationId,subject,from,bodyPreview,receivedDateTime,isRead";
  const days = new Date(Date.now() - 180 * 86400000).toISOString();
  const params = search ? new URLSearchParams({ "$select":select, "$top":"25", "$search":'"' + String(search).replace(/["\\]/g, "").slice(0,180) + '"' })
    : new URLSearchParams({ "$select":select, "$top":"35", "$filter":"receivedDateTime ge " + days, "$orderby":"receivedDateTime desc" });
  const response = await providerRequest(graph + "/mailFolders/inbox/messages?" + params, token);
  const output = new Map();
  for (const m of response.value || []) {
    const old = output.get(m.conversationId);
    if (old && old.date >= m.receivedDateTime) { old.unread ||= !m.isRead; continue; }
    output.set(m.conversationId, { threadId: m.conversationId, revision: m.id, from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "", subject: m.subject || "(No subject)", preview: m.bodyPreview || "", date: m.receivedDateTime, unread: !m.isRead || !!old?.unread });
  }
  return [...output.values()];
}

export async function fullThread(account, token, id) {
  if (account.provider === "gmail") {
    const t = await providerRequest(google + "/threads/" + encodeURIComponent(id) + "?format=full", token);
    return (t.messages || []).map(m => ({
      id: m.id, from: header(m,"from"), replyTo: header(m,"reply-to") || header(m,"from"), subject: header(m,"subject"),
      date: date(m.internalDate), body: mimeBody(m.payload) || strip(m.snippet || ""), to:header(m,"to"), cc:header(m,"cc"), attachments:gmailFiles(m.payload), messageId: header(m,"message-id"), references: header(m,"references"),
    }));
  }
  const params = new URLSearchParams({ "$filter":"conversationId eq '" + id.replaceAll("'", "''") + "'", "$top":"100", "$select":"id,subject,receivedDateTime,from,replyTo,body,bodyPreview" });
  const res = await providerRequest(graph + "/messages?" + params, token, { headers: { Prefer: 'outlook.body-content-type="text"' } });
  return (res.value || []).map(m => ({
    id: m.id, from: m.from?.emailAddress?.address || "", replyTo:m.replyTo?.[0]?.emailAddress?.address || m.from?.emailAddress?.address,
    subject: m.subject || "", date: m.receivedDateTime, body: m.body?.contentType === "text" ? m.body.content : strip(m.body?.content || m.bodyPreview || ""),
  })).sort((a,b) => a.date.localeCompare(b.date));
}

export class ReplyTargetError extends Error {}

function quoteEmail(parent, body, html) {
  const marker = "On " + new Date(parent.date).toUTCString() + ", " + parent.from + " wrote:";
  const source = String(parent.body || "");
  const excerpt = source.slice(0,12000) + (source.length > 12000 ? "\n[…]" : "");
  const quote = excerpt.split(/\r?\n/).map(line => "> " + line).join("\n");
  const escape = value => value.replace(/[&<>]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" })[char]);
  const replyHTML = html || "<div style=\"white-space:pre-wrap\">" + escape(body) + "</div>";
  return {
    body: body + "\n\n" + marker + "\n" + quote,
    html: replyHTML + '<div class="gmail_quote"><p>' + escape(marker) + '</p><blockquote style="white-space:pre-wrap">' + escape(excerpt) + '</blockquote></div>',
  };
}
export async function sendReply(account, token, id, body, cc, options = {}, targetMessageId) {
  const messages = await fullThread(account, token, id);
  const incoming = m => address(m.from).toLowerCase() !== account.email.toLowerCase();
  const parent = targetMessageId ? messages.find(m => m.id === targetMessageId && incoming(m)) : [...messages].reverse().find(incoming);
  const to = address(parent?.replyTo);
  if (!parent || !to) throw new ReplyTargetError(targetMessageId ? "That email is no longer available for reply in this thread. Reopen the thread and select it again." : "There is no incoming message to reply to.");
  if (account.provider === "outlook") {
    const endpoint = graph + "/messages/" + encodeURIComponent(parent.id);
    if (!cc.length) return providerRequest(endpoint + "/reply", token, { method:"POST", body:JSON.stringify({ comment:body }) });
    const draft = await providerRequest(endpoint + "/createReply", token, { method:"POST", body:JSON.stringify({ comment:body }) });
    try {
      await providerRequest(graph + "/messages/" + encodeURIComponent(draft.id), token, { method:"PATCH", body:JSON.stringify({ ccRecipients:cc.map(addr => ({ emailAddress:{ address:addr } })) }) });
      return await providerRequest(graph + "/messages/" + encodeURIComponent(draft.id) + "/send", token, { method:"POST" });
    } catch (error) {
      await providerRequest(graph + "/messages/" + encodeURIComponent(draft.id), token, { method:"DELETE" }).catch(() => {});
      throw error;
    }
  }
  if (!parent.messageId) throw new ReplyTargetError("This Gmail message is missing its reply headers.");
  const quote = targetMessageId ? quoteEmail(parent,body,options.html) : {body,html:options.html};
  const raw = mimeMessage({from:account.email,to:[to],cc,subject:parent.subject,parent,...options,...quote});
  return providerRequest(google + "/messages/send", token, { method:"POST", body:JSON.stringify({ threadId:id, raw:b64(encoder.encode(raw)) }) });
}


const mime64 = text => bytes64(encoder.encode(text));
const fold64 = value => value.match(/.{1,76}/g)?.join("\r\n") || "";
const mimeHeader = text => "=?UTF-8?B?" + mime64(String(text).replace(/[\r\n]/g," ")) + "?=";
export function emailList(values, required = false) {
  if (!Array.isArray(values) || values.length > 25 || values.some(value => typeof value !== "string" || !email(value) || /[,;:"()\[\]\\]/.test(value))) throw new Error("Invalid email recipients.");
  if (required && !values.length) throw new Error("Add at least one recipient.");
  return [...new Set(values)];
}
export function sendOptions(data) {
  const html = typeof data.html === "string" && data.html.length <= 500000 ? data.html : "";
  const files = Array.isArray(data.files) ? data.files : [];
  if (files.length > 12 || files.reduce((n,f) => n + (typeof f?.data === "string" ? f.data.length : 10000000),0) > 7000000) throw new Error("Attachments exceed this version’s 5 MB limit.");
  for (const f of files) {
    if (typeof f.name !== "string" || f.name.length > 230 || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.data)
      || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(f.type)
      || (f.cid && !/^[a-z0-9-]{1,75}$/i.test(f.cid))) throw new Error("Invalid attachment.");
  }
  return { html, files };
}
function mimePart(type,value) {
  return ["Content-Type: "+type,"Content-Transfer-Encoding: base64","",fold64(value)].join("\r\n");
}
function mimeMessage({from,to,cc=[],bcc=[],subject,body,html,files=[],parent}) {
  const headers=["From: "+from,"To: "+to.join(", "),"Subject: "+mimeHeader(subject),"MIME-Version: 1.0"];
  if(cc.length)headers.push("Cc: "+cc.join(", "));
  if(bcc.length)headers.push("Bcc: "+bcc.join(", "));
  if(parent){
    const safe = value => value.replace(/[\r\n]/g,"");
    headers.push("In-Reply-To: "+safe(parent.messageId),"References: "+safe([parent.references,parent.messageId].filter(Boolean).join(" ")));
  }
  const container=(kind,parts)=>{
    const boundary="mailthread-"+crypto.randomUUID();
    return "Content-Type: multipart/"+kind+'; boundary="'+boundary+'"\r\n\r\n'+parts.map(p=>"--"+boundary+"\r\n"+p+"\r\n").join("")+"--"+boundary+"--";
  };
  const text=mimePart("text/plain; charset=UTF-8",mime64(body));
  const attachment=f=>{
    const filename=encodeURIComponent(f.name).replace(/'/g,"%27");
    return ["Content-Type: "+f.type,"Content-Disposition: "+(f.cid?"inline":"attachment")+"; filename*=UTF-8''"+filename,...(f.cid?["Content-ID: <"+f.cid+">"]:[]),"Content-Transfer-Encoding: base64","",fold64(f.data)].join("\r\n");
  };
  const inline=files.filter(f=>f.cid), ordinary=files.filter(f=>!f.cid);
  let content=html?container("alternative",[text,mimePart("text/html; charset=UTF-8",mime64(html))]):text;
  if(inline.length)content=container("related",[content,...inline.map(attachment)]);
  if(ordinary.length)content=container("mixed",[content,...ordinary.map(attachment)]);
  return headers.join("\r\n")+"\r\n"+content;
}
export async function sendGmail(account,token,{to,cc,bcc,subject,body,...options}) {
  if(account.provider!=="gmail")throw new Error("Only Gmail send is enabled.");
  const raw=mimeMessage({from:account.email,to,cc,bcc,subject,body,...options});
  return providerRequest(google+"/messages/send",token,{method:"POST",body:JSON.stringify({raw:b64(encoder.encode(raw))})});
}
function gmailFiles(payload) {
  if(!payload)return [];
  const f=payload.filename&&payload.body?.attachmentId?[{name:payload.filename,id:payload.body.attachmentId,size:payload.body.size||0}]:[];
  return f.concat(...(payload.parts||[]).map(gmailFiles));
}
export async function getGmailAttachment(token,message,id) {
  const data=await providerRequest(google+"/messages/"+encodeURIComponent(message)+"/attachments/"+encodeURIComponent(id),token);
  if(!data.data)throw new Error("This attachment is empty or unavailable.");
  return unb64(data.data);
}


const addresses = value => [...new Set((String(value).match(/[a-z0-9.!%+_-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[]).map(s=>s.toLowerCase()))];
export async function gmailContactPage(account,token,{contact,mode,cursor}) {
  const mailbox=account.email.toLowerCase();
  const q="from:"+contact+" {to:"+mailbox+" cc:"+mailbox+"} -in:spam -in:trash -in:drafts";
  const params=new URLSearchParams({q,maxResults:"18"});
  if(cursor)params.set("pageToken",cursor);
  const page=await providerRequest(google+"/messages?"+params,token);
  const items=await Promise.all((page.messages||[]).map(async item=>{
    const m=await providerRequest(google+"/messages/"+encodeURIComponent(item.id)+"?format=metadata",token);
    if(!addresses(header(m,"from")).includes(contact))return null;
    const to=addresses(header(m,"to")),cc=addresses(header(m,"cc")),bcc=addresses(header(m,"bcc"));
    if(!to.includes(mailbox)&&!cc.includes(mailbox))return null;
    const direct=to.length===1&&to[0]===mailbox&&!cc.length&&!bcc.some(x=>x!==mailbox);
    if(mode==="direct"&&!direct)return null;
    return {
      id:m.id,threadId:m.threadId,revision:m.id,from:header(m,"from"),subject:header(m,"subject")||"(No subject)",preview:strip(m.snippet||""),
      date:date(m.internalDate),unread:m.labelIds?.includes("UNREAD")||false,to:header(m,"to"),cc:header(m,"cc"),direct,
    };
  }));
  return {messages:items.filter(Boolean),nextCursor:page.nextPageToken||null};
}
