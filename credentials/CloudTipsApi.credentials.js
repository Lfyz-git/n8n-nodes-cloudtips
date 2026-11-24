'use strict';
class CloudTipsApi {
  name = 'cloudTipsApi';
  displayName = 'CloudTips Widget';
  properties = [{ displayName: 'Widget URL or ID', name: 'widget', type: 'string', typeOptions: {password: true}, default: '', required: true }];
}
module.exports = {CloudTipsApi};
