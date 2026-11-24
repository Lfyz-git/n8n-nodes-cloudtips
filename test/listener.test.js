'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {widgetId,notification,startListener}=require('../nodes/CloudTips/listener');
const RS='\x1e';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await sleep(5);}throw Error('timed out');}
const payload={id:'sample-id',title:'Example отправил 1000000₽.',comment:'test'};
const event={type:1,target:'SendNotification',arguments:[payload]};
class Socket extends EventEmitter {
  sent=[]; terminated=false;
  send(s){this.sent.push(s);}
  terminate(){this.terminated=true;this.emit('close');}
}
function setup(extra={}){
  const requests=[],sockets=[],events=[],logs=[];let count=0;
  const listener=startListener({widget:'sampleWidget123',onEvent:x=>events.push(x),log:x=>logs.push(x),minDelay:5,maxDelay:20,pingMs:10,idleMs:200,
    fetchImpl:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>url.endsWith('/init')?{connectionToken:'token'+(++count)}:{status:'Ok'}};},
    makeSocket:(url,opts)=>{const s=new Socket();s.url=url;s.opts=opts;sockets.push(s);return s;},...extra});
  return {listener,requests,sockets,events,logs};
}
test('widget URL allowlist and ID',()=>{assert.equal(widgetId('https://stream.cloudtips.ru/n/sampleWidget123'),'sampleWidget123');assert.throws(()=>widgetId('https://evil.test/n/sampleWidget123'));assert.throws(()=>widgetId('https://stream.cloudtips.ru/s/sampleWidget123'));assert.throws(()=>widgetId('a/b'));});
test('only notification invocations; no payment verification claim',()=>{assert.equal(notification({type:6}),null);assert.equal(notification({...event,target:'Other'}),null);assert.equal(notification({...event,arguments:[{}]}),null);assert.deepEqual(notification(event),{notificationId:'sample-id',title:payload.title,comment:'test',eventType:'SendNotification',paymentVerified:false,raw:payload});});
test('REST order, origin, framing, heartbeat, and fresh token after reconnect',async t=>{const s=setup();t.after(()=>s.listener.close());await until(()=>s.sockets.length===1);assert.equal(s.requests[0].url,'https://streamers-api.cloudtips.ru/notification/sampleWidget123/init');assert.match(s.requests[1].url,/connectionToken=token1&authType=Notifications$/);const ws=s.sockets[0];assert.match(ws.url,/:3030\/notification\/socket\?connectionToken=token1$/);assert.equal(ws.opts.origin,'https://stream.cloudtips.ru');ws.emit('open');assert.equal(ws.sent[0],JSON.stringify({protocol:'json',version:1})+RS);const wire=JSON.stringify(event)+RS;ws.emit('message','{}'+RS+'{"type":6}'+RS+wire.slice(0,12));ws.emit('message',wire.slice(12));assert.equal(s.events.length,1);await until(()=>ws.sent.includes('{"type":6}'+RS));ws.emit('close');await until(()=>s.sockets.length===2);assert.match(s.sockets[1].url,/token2$/);assert.equal(s.requests.length,4);s.listener.close();await sleep(30);assert.equal(s.sockets.length,2);assert.ok(s.sockets[1].terminated);});
test('reconnect after rejected handshake',async t=>{const s=setup();t.after(()=>s.listener.close());await until(()=>s.sockets.length===1);s.sockets[0].emit('open');s.sockets[0].emit('message','{"error":"bad"}'+RS);await until(()=>s.sockets.length===2);assert.equal(s.events.length,0);});
test('deactivation aborts in-flight initialization and prevents late socket',async()=>{let resolve;const s=setup({fetchImpl:()=>new Promise(r=>resolve=r)});await until(()=>resolve);s.listener.close();resolve({ok:true,json:async()=>({connectionToken:'secret'})});await sleep(30);assert.equal(s.sockets.length,0);});
test('reconnect after REST error without logging secret',async t=>{let calls=0;const s=setup({fetchImpl:async url=>{if(++calls===1)throw Error('secret');return {ok:true,json:async()=>url.endsWith('/init')?{connectionToken:'token'}:{status:'Ok'}};}});t.after(()=>s.listener.close());await until(()=>s.sockets.length===1);assert.equal(calls,3);assert.ok(s.logs.every(x=>!x.includes('secret')));});
test('reconnect when connection becomes silent',async t=>{const s=setup({idleMs:25});t.after(()=>s.listener.close());await until(()=>s.sockets.length===1);const ws=s.sockets[0];ws.emit('open');ws.emit('message','{}'+RS);await until(()=>s.sockets.length===2);assert.ok(ws.terminated);assert.ok(s.logs.some(x=>x.includes('timeout')));});
test('rejected subscription does not open socket',async t=>{let calls=0;const s=setup({fetchImpl:async url=>{calls++;return {ok:true,json:async()=>url.endsWith('/init')?{connectionToken:'token'}:{status:'Denied'}};}});t.after(()=>s.listener.close());await until(()=>calls>=4);assert.equal(s.sockets.length,0);});
