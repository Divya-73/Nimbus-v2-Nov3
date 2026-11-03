import { commitOnlyContent, emptyContent, isFilled, pushList, pushSet } from './uci';

export function defaultUrlFilterForm(ttype = 'url_filter') {
  return {
    tempName: '',
    ttype,
    overWrite: false,
    dnsService: '',
    forceDns: '',
    compressedCache: '',
    configUpdateEnabled: false,
    configUpdateMode: '',
    configUpdateHour: '',
    configUpdateMinute: '',
    dnsmasqValidityCheck: '0',
    debug: '0',
    allowedDomains: [],
    blockedDomains: [],
    listUrls: [],
  };
}

export function buildUrlFilterContent(formObj = {}) {
  const stop = ['adblock-fast'];
  const start = ['adblock-fast'];
  const hasConfig =
    formObj.overWrite ||
    formObj.configUpdateEnabled ||
    isFilled(formObj.dnsService) ||
    isFilled(formObj.forceDns) ||
    isFilled(formObj.compressedCache) ||
    (formObj.allowedDomains || []).some(isFilled) ||
    (formObj.blockedDomains || []).some(isFilled) ||
    (formObj.listUrls || []).some((item) => isFilled(item?.url));

  if (!hasConfig) {
    return commitOnlyContent({ formValue: formObj });
  }

  const content = emptyContent({
    stop,
    start,
    formValue: formObj,
  });

  if (formObj.overWrite) {
    content.opts.push(
      `commit && ubus call uci delete '{"config":"adblock-fast", "type":"source"}'`
    );
    content.opts.push('delete adblock-fast.config.allowed_domain');
    content.opts.push('delete adblock-fast.config.blocked_domain');
    content.opts.push('delete adblock-fast.config.allowed_domains_url');
    content.opts.push('delete adblock-fast.config.blocked_domains_url');
  }

  content.opts.push(`set adblock-fast.config='adblock-fast'`);
  content.opts.push(`set adblock-fast.config.enabled='1'`);
  pushSet(content.opts, 'adblock-fast.config.dns', formObj.dnsService);
  pushSet(content.opts, 'adblock-fast.config.force_dns', formObj.forceDns);
  pushSet(content.opts, 'adblock-fast.config.compressed_cache', formObj.compressedCache);
  pushSet(content.opts, 'adblock-fast.config.dnsmasq_validity_check', formObj.dnsmasqValidityCheck ?? '0');
  pushSet(content.opts, 'adblock-fast.config.debug', formObj.debug ?? '0');

  if (formObj.configUpdateEnabled) {
    pushSet(content.opts, 'adblock-fast.config.auto_update_enabled', '1');
    pushSet(content.opts, 'adblock-fast.config.auto_update_mode', formObj.configUpdateMode);
    pushSet(content.opts, 'adblock-fast.config.auto_update_hour', formObj.configUpdateHour);
    pushSet(content.opts, 'adblock-fast.config.auto_update_minute', formObj.configUpdateMinute);
  } else {
    content.opts.push('del adblock-fast.config.auto_update_enabled');
    content.opts.push('del adblock-fast.config.auto_update_mode');
    content.opts.push('del adblock-fast.config.auto_update_hour');
    content.opts.push('del adblock-fast.config.auto_update_minute');
  }

  pushList(content.opts, 'adblock-fast.config.allowed_domain', formObj.allowedDomains || []);
  pushList(content.opts, 'adblock-fast.config.blocked_domain', formObj.blockedDomains || []);

  for (const item of formObj.listUrls || []) {
    if (!item?.url) continue;
    const action = item.action || 'block';
    const listOption = action === 'allow' ? 'allowed_domains_url' : 'blocked_domains_url';
    content.opts.push(`add_list adblock-fast.config.${listOption}='${item.url}'`);
    content.opts.push('add adblock-fast source');
    pushSet(content.opts, 'adblock-fast.@source[-1].enabled', item.enabled === false ? '0' : '1');
    pushSet(content.opts, 'adblock-fast.@source[-1].action', action);
    pushSet(content.opts, 'adblock-fast.@source[-1].name', item.name || '');
    pushSet(content.opts, 'adblock-fast.@source[-1].url', item.url);
  }

  content.opts.push('/etc/init.d/adblock-fast enable');
  content.opts.push(
    `commit adblock-fast && ubus call luci setInitAction '{"name":"adblock-fast", "action":"enable"}'`
  );
  content.opts.push('/etc/init.d/adblock-fast restart');
  content.opts.push(`ubus call luci setInitAction '{"name":"adblock-fast", "action":"restart"}'`);
  content.opts.push(`ubus call luci setInitAction '{"name":"dnsmasq", "action":"restart"}'`);
  return content;
}
