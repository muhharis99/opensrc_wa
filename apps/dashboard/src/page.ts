export const dashboardHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>opensrc_wa Dashboard</title>
  <style>
    :root{font-family:Inter,system-ui,sans-serif;color:#17212b;background:#f4f7f9}body{margin:0}.wrap{max-width:1100px;margin:auto;padding:28px}.hero,.card{background:#fff;border:1px solid #dfe7ec;border-radius:16px;padding:20px;box-shadow:0 8px 30px rgba(20,40,60,.06)}.hero{display:flex;justify-content:space-between;gap:20px;align-items:center}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:16px}input,button{border:1px solid #cbd8df;border-radius:10px;padding:10px 12px;font:inherit}button{cursor:pointer;background:#117865;color:white;border:0}.muted{color:#65747f}.badge{display:inline-block;padding:5px 9px;border-radius:999px;background:#fff2cc;color:#715700;font-size:12px}.ok{background:#dcfce7;color:#166534}pre{white-space:pre-wrap;max-height:360px;overflow:auto;background:#0e1720;color:#d7e5ee;padding:14px;border-radius:10px}label{display:block;font-size:13px;margin-bottom:6px}.toolbar{display:flex;gap:8px;flex-wrap:wrap}.toolbar input{min-width:280px;flex:1}</style>
</head>
<body><main class="wrap">
  <section class="hero"><div><h1>opensrc_wa</h1><p class="muted">Clean-room feature runtime & gateway.</p></div><span class="badge">Live protocol: BLOCKED</span></section>
  <section class="card" style="margin-top:16px"><label for="key">API key</label><div class="toolbar"><input id="key" type="password" autocomplete="off" placeholder="Masukkan X-API-Key"><button onclick="loadAll()">Muat Dashboard</button></div><p class="muted">Kunci hanya disimpan pada sessionStorage browser ini.</p></section>
  <section class="grid"><article class="card"><h2>Readiness</h2><pre id="ready">Belum dimuat</pre></article><article class="card"><h2>Capabilities</h2><pre id="capabilities">Belum dimuat</pre></article><article class="card"><h2>Sessions</h2><pre id="sessions">Belum dimuat</pre></article></section>
</main><script>
const keyInput=document.getElementById('key');keyInput.value=sessionStorage.getItem('opensrc_wa_key')||'';
async function api(path,auth=true){const headers=auth?{'X-API-Key':keyInput.value}:{};const response=await fetch(path,{headers});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||('HTTP '+response.status));return body.data}
async function loadAll(){sessionStorage.setItem('opensrc_wa_key',keyInput.value);try{const [ready,capabilities,sessions]=await Promise.all([api('/ready',false),api('/api/v1/capabilities'),api('/api/v1/sessions')]);document.getElementById('ready').textContent=JSON.stringify(ready,null,2);document.getElementById('capabilities').textContent=JSON.stringify(capabilities.summary,null,2);document.getElementById('sessions').textContent=JSON.stringify(sessions,null,2)}catch(error){document.getElementById('ready').textContent=String(error)}}
</script></body></html>`;
