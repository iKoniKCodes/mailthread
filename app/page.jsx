"use client";
import { useEffect, useState } from "react";

async function api(path, body) {
  const response = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Mailthread is unavailable.");
  return data;
}

export default function Mailthread() {
  const [state, setState] = useState(null);
  const [view, setView] = useState("");
  const [notice, setNotice] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const result = new URLSearchParams(location.search).get("connection");
    if (result) {
      setView("mailboxes");
      setNotice(result === "success" ? "Gmail account connected." : "Gmail authorization was incomplete.");
      history.replaceState(null, "", "/");
    }
    api("status").then(setState).catch(error => setNotice(error.message));
  }, []);

  async function unlock(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);setNotice("");
    try {
      await api("session", { password: key });
      setKey("");
      setState(await api("status"));
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  if (state?.authenticated) return <iframe
    title="Mailthread live Gmail workspace"
    src={view === "mailboxes" ? "/workspace/?view=mailboxes" : "/workspace/"}
    style={{ display:"block", width:"100%", height:"100dvh", border:0 }}
  />;

  return <div className="shell">
    <header><strong className="brand">Mailthread</strong><a className="button" href="/demo/">Open demo</a></header>
    <main>
      <h1>Unlock Mailthread</h1>
      <p className="muted">Open your Gmail workspace with your Mailthread access key.</p>
      {notice && <p className="banner" role="status">{notice}</p>}
      {state?.configured ? <form className="stack" onSubmit={unlock}>
        <label>Access key<input type="password" autoComplete="current-password" value={key} onChange={event => setKey(event.target.value)} required /></label>
        <button disabled={busy} className="primary">{busy ? "Unlocking…" : "Unlock"}</button>
      </form> : <p className="muted">{state ? "The Worker access key is not configured." : "Checking Mailthread…"}</p>}
    </main>
  </div>;
}
