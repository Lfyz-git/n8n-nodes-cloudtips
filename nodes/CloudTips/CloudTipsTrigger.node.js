'use strict';
const {startListener,widgetId}=require('./listener');
class CloudTipsTrigger {
  description={
    displayName:'CloudTips Trigger', name:'cloudTipsTrigger', group:['trigger'], version:1,
    description:'Receive unverified CloudTips streaming notifications (including tests)',
    defaults:{name:'CloudTips Trigger'}, inputs:[], outputs:['main'],
    credentials:[{name:'cloudTipsApi',required:true}], properties:[],
  };
  async trigger() {
    const credentials=await this.getCredentials('cloudTipsApi');
    const widget=widgetId(credentials.widget);
    const WebSocket=require('ws');
    const listener=startListener({widget,makeSocket:(url,opts)=>new WebSocket(url,opts),
      log:(message)=>this.logger?.info(message),onEvent:(event)=>this.emit([[{json:event}]])});
    return {closeFunction:async()=>listener.close()};
  }
}
module.exports={CloudTipsTrigger};
