import { emptyContent, pushSet } from './uci';

export function defaultWirelessForm(ttype = 'wireless') {
  return {
    tempName: '',
    ttype,
    wifi: {
      rangeType: '2g',
      ssid: '',
      encryption: 'psk2',
      key: '',
      channel: 'auto',
      htmode: 'HT20',
      txpower: '20',
      country: 'IN',
      hidden: false,
      disabled: false,
    },
  };
}

export function buildWirelessContent(formObj = {}) {
  const wifi = formObj.wifi || {};
  const content = emptyContent({
    stop: ['wireless'],
    start: ['wireless'],
    formValue: formObj,
  });

  pushSet(content.opts, 'wireless.radio0.channel', wifi.channel);
  pushSet(content.opts, 'wireless.radio0.htmode', wifi.htmode);
  pushSet(content.opts, 'wireless.radio0.txpower', wifi.txpower);
  pushSet(content.opts, 'wireless.radio0.country', wifi.country);
  pushSet(content.opts, 'wireless.radio0.disabled', wifi.disabled ? '1' : '0');
  pushSet(content.opts, 'wireless.@wifi-iface[0].ssid', wifi.ssid);
  pushSet(content.opts, 'wireless.@wifi-iface[0].encryption', wifi.encryption);
  pushSet(content.opts, 'wireless.@wifi-iface[0].key', wifi.key);
  pushSet(content.opts, 'wireless.@wifi-iface[0].hidden', wifi.hidden ? '1' : '0');
  content.opts.push('commit wireless');
  return content;
}
