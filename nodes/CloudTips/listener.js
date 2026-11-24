'use strict';
const BASE = 'https://streamers-api.cloudtips.ru';
const ORIGIN = 'https://stream.cloudtips.ru';
const RS = '\x1e';
function widgetId(input) {
  let id = String(input ?? '').trim();
  if (id.startsWith('https://')) {
    const url = new URL(id);
    if (url.origin !== ORIGIN || url.search || url.hash || url.username || url.password) throw Error('Invalid CloudTips widget URL');
    id = /^\/n\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1] ?? '';
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) throw Error('Invalid CloudTips widget ID');
  return id;
}
function notification(frame) {
  if (frame?.type !== 1 || frame.target !== 'SendNotification') return null;
  const p = frame.arguments?.[0];
  if (!p || typeof p.id !== 'string' || !p.id || typeof p.title !== 'string' || !p.title) return null;
  return {notificationId:p.id, title:p.title, comment:typeof p.comment === 'string' ? p.comment : '', eventType:'SendNotification', paymentVerified:false, raw:p};
}
function startListener({widget, onEvent, log = () => {}, fetchImpl = globalThis.fetch, makeSocket, pingMs=15000, idleMs=45000, minDelay=1000, maxDelay=60000, stableMs=60000}) {
  const id = widgetId(widget);
  let stopped=false, socket, controller, reconnect, heartbeat, failures=0;
  let generation=0;
  function retry(attempt, reason) {
    if (stopped || attempt !== generation) return;
    generation++;
    clearInterval(heartbeat); clearTimeout(reconnect);
    controller?.abort();
    const old=socket; socket=undefined;
    if (old) old.terminate();
    const delay=Math.min(maxDelay,minDelay*2**Math.min(failures++,16));
    log('CloudTips: '+reason+'; reconnect in '+delay+' ms');
    reconnect=setTimeout(() => void connect(),delay);
  }
  async function api(path, signal) {
    const r=await fetchImpl(BASE+path,{headers:{Origin:ORIGIN, Accept:'application/json'},redirect:'error',signal});
    if (!r.ok) throw Error('HTTP error');
    return r.json();
  }
  async function connect() {
    if(stopped) return;
    const attempt=++generation;
    controller=new AbortController();
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
    try {
      const {connectionToken:token}=await api('/notification/'+encodeURIComponent(id)+'/init',signal);
      if(stopped || attempt!==generation) return;
      if(typeof token!=='string'||!token) throw Error('Missing token');
      const query=new URLSearchParams({connectionToken:token,authType:'Notifications'});
      const auth=await api('/connection?'+query,signal);
      if(stopped || attempt!==generation) return;
      if(auth.status!=='Ok') throw Error('Subscription rejected');
      const ws=makeSocket('wss://streamers-api.cloudtips.ru:3030/notification/socket?'+new URLSearchParams({connectionToken:token}),{origin:ORIGIN,handshakeTimeout:10000,maxPayload:1024*1024,followRedirects:false});
      socket=ws;
      let ready=false, lastReceived=Date.now(), lastPing=0, readyAt=0, buffer='';
      const live=()=>!stopped && generation===attempt;
      const fail=(reason)=>retry(attempt,reason);
      function send(frame) {if(live()) try {ws.send(JSON.stringify(frame)+RS);} catch {fail('send failed');}}
      ws.on('error',()=>fail('socket error'));
      ws.on('close',()=>fail('socket closed'));
      ws.on('open',()=>{
        if(!live()) return;
        lastReceived=Date.now();
        send({protocol:'json',version:1});
        if(!live()) return;
        heartbeat=setInterval(()=>{
          if(!live()) return;
          const now=Date.now();
          if(now-lastReceived>=idleMs || (!ready && now-lastReceived>=10000)) return fail('SignalR timeout');
          if(ready && now-readyAt>=stableMs) failures=0;
          if(ready && now-lastPing>=pingMs) {lastPing=now;send({type:6});}
        },Math.min(pingMs,1000));
      });
      ws.on('message',(data)=>{
        if(!live()) return;
        buffer+=data.toString();
        if(buffer.length>1024*1024) return fail('frame limit exceeded');
        const parts=buffer.split(RS); buffer=parts.pop();
        for(const part of parts) {
          if(!live()) return;
          if(!part) continue;
          let frame;
          try {frame=JSON.parse(part);} catch {return fail('invalid SignalR frame');}
          lastReceived=Date.now();
          if(!ready) {
            if(!frame || typeof frame!=='object' || Array.isArray(frame) || Object.keys(frame).length!==0) return fail('SignalR handshake rejected');
            ready=true; readyAt=lastReceived;lastPing=lastReceived;
            log('CloudTips: SignalR connected');continue;
          }
          if(frame?.type===7) return fail('SignalR closed');
          const event=notification(frame);
          if(event) {try {onEvent(event);} catch {log('CloudTips: event dispatch failed');}}
        }
      });
    } catch {retry(attempt,'initialization failed');}
  }
  reconnect=setTimeout(()=>void connect(),0);
  return {close(){if(stopped)return;stopped=true;generation++;clearTimeout(reconnect);clearInterval(heartbeat);controller?.abort();const old=socket;socket=undefined;old?.terminate();}};
}
module.exports={widgetId,notification,startListener};
