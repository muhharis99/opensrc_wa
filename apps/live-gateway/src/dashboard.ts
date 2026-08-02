export const liveDashboardHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>opensrc_wa Live Sessions</title>
  <style>
    :root{font-family:Inter,system-ui,sans-serif;color:#17202a;background:#f5f7fa}*{box-sizing:border-box}
    body{margin:0}.top{background:#fff;border-bottom:1px solid #e6e9ef;padding:18px 24px;display:flex;justify-content:space-between;align-items:center}
    main{max-width:1180px;margin:24px auto;padding:0 20px}.card{background:#fff;border:1px solid #e6e9ef;border-radius:14px;padding:18px;box-shadow:0 5px 18px rgba(20,30,50,.05);margin-bottom:18px}
    h1,h2{margin:0 0 12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
    input,button,select{font:inherit;border-radius:9px;border:1px solid #ccd3dc;padding:10px 12px}button{cursor:pointer;background:#17202a;color:#fff;border-color:#17202a}button.alt{background:#fff;color:#17202a}button.danger{background:#a61b1b;border-color:#a61b1b}
    .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.grow{flex:1}.muted{color:#687386;font-size:13px}.state{font-weight:700}.qr{width:280px;max-width:100%;border:1px solid #e6e9ef;border-radius:12px;background:#fff;padding:8px}
    pre{background:#10141b;color:#d9e2ef;border-radius:10px;padding:12px;overflow:auto;max-height:240px}.session{border:1px solid #e7eaf0;border-radius:12px;padding:14px}.hidden{display:none}
  </style>
</head>
<body>
  <header class="top"><div><strong>opensrc_wa</strong><div class="muted">Live provider dashboard</div></div><span id="health" class="state">Memeriksa…</span></header>
  <main>
    <section class="card">
      <h2>Akses API</h2>
      <div class="row"><input id="apiKey" class="grow" type="password" placeholder="X-API-Key"><button id="saveKey">Gunakan</button><button id="refresh" class="alt">Muat ulang</button></div>
      <p class="muted">API key hanya disimpan dalam sessionStorage browser ini.</p>
    </section>
    <section class="card">
      <h2>Buat atau sambungkan session</h2>
      <div class="row"><input id="sessionId" placeholder="contoh: utama"><input id="phone" placeholder="62812… (opsional pairing code)"><button id="connect">Connect</button></div>
    </section>
    <section class="card">
      <div class="row"><h2 class="grow">Session</h2><span id="queue" class="muted"></span></div>
      <div id="sessions" class="grid"></div>
    </section>
    <section class="card">
      <h2>Event / hasil terakhir</h2>
      <pre id="log">Belum ada aktivitas.</pre>
    </section>
  </main>
<script>
const keyInput=document.getElementById('apiKey');const log=document.getElementById('log');const sessionsEl=document.getElementById('sessions');
keyInput.value=sessionStorage.getItem('opensrc_wa_api_key')||'';
function headers(json=true){const h={'X-API-Key':keyInput.value};if(json)h['Content-Type']='application/json';return h}
function show(value){log.textContent=typeof value==='string'?value:JSON.stringify(value,null,2)}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{...headers(options.body!==undefined),...(options.headers||{})}});const contentType=response.headers.get('content-type')||'';const data=contentType.includes('application/json')?await response.json():await response.text();if(!response.ok)throw new Error(typeof data==='string'?data:(data.error?.message||response.statusText));return data.data??data}
async function refresh(){try{const health=await fetch('/health').then(r=>r.json());document.getElementById('health').textContent=health.data?.status==='ok'?'Online':'Bermasalah';const data=await api('/api/v1/live/sessions');document.getElementById('queue').textContent=data.queue?('Queue: '+data.queue.pending+' pending'):'';render(data.sessions||data)}catch(error){show(error.message)}}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(items){sessionsEl.innerHTML='';for(const s of items){const el=document.createElement('article');el.className='session';const qr=s.qr_data_url?'<img class="qr" alt="QR pairing" src="'+esc(s.qr_data_url)+'">':'';el.innerHTML='<h3>'+esc(s.sessionId)+'</h3><p>Status: <span class="state">'+esc(s.state)+'</span></p>'+qr+'<p class="muted">Pairing: '+esc(s.pairingCode||'-')+'<br>Update: '+esc(s.updatedAt)+'</p><div class="row"><button data-a="disconnect" class="alt">Disconnect</button><button data-a="logout" class="danger">Logout</button><button data-a="qr" class="alt">Buka PNG</button></div>';for(const b of el.querySelectorAll('button'))b.onclick=()=>sessionAction(s.sessionId,b.dataset.a);sessionsEl.appendChild(el)}}
async function sessionAction(id,action){try{if(action==='qr'){window.open('/api/v1/live/sessions/'+encodeURIComponent(id)+'/qr.png?api_key='+encodeURIComponent(keyInput.value),'_blank','noopener');return}const data=await api('/api/v1/live/sessions/'+encodeURIComponent(id)+'/'+action,{method:'POST',body:'{}'});show(data);await refresh()}catch(error){show(error.message)}}
document.getElementById('saveKey').onclick=()=>{sessionStorage.setItem('opensrc_wa_api_key',keyInput.value);refresh()};
document.getElementById('refresh').onclick=refresh;
document.getElementById('connect').onclick=async()=>{try{const id=document.getElementById('sessionId').value.trim();const phone=document.getElementById('phone').value.trim();if(!id)throw new Error('sessionId wajib diisi');const data=await api('/api/v1/live/sessions/'+encodeURIComponent(id)+'/connect',{method:'POST',body:JSON.stringify(phone?{phone}:{})});show(data);setTimeout(refresh,800)}catch(error){show(error.message)}};
refresh();setInterval(refresh,5000);
</script>
</body></html>`;
