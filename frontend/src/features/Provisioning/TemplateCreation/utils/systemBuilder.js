import { emptyContent, pushDel, pushList, pushSet } from './uci';

export function defaultSystemForm(ttype = 'system') {
  return {
    tempName: '',
    ttype,
    system: {
      hostname: '',
      description: '',
      notes: '',
      zonename: 'Asia/Kolkata',
      log_size: '64',
      log_file: '',
    },
    ntp: {
      enabled: true,
      enable_server: false,
      use_dhcp: true,
      server: [''],
    },
  };
}

export function buildSystemContent(formObj = {}) {
  const system = formObj.system || {};
  const ntp = formObj.ntp || {};
  const content = emptyContent({
    stop: ['system'],
    start: ['system'],
    restart: ['system'],
    formValue: formObj,
  });

  pushSet(content.opts, 'system.@system[0].hostname', system.hostname);
  pushSet(content.opts, 'system.@system[0].description', system.description);
  pushSet(content.opts, 'system.@system[0].notes', system.notes);
  pushSet(content.opts, 'system.@system[0].zonename', system.zonename);
  pushSet(content.opts, 'system.@system[0].log_size', system.log_size);
  if (system.log_file) pushSet(content.opts, 'system.@system[0].log_file', system.log_file);
  else pushDel(content.opts, 'system.@system[0].log_file');

  pushDel(content.opts, 'system.ntp.server');
  if (ntp.enabled === false) {
    pushSet(content.opts, 'system.ntp.enabled', '0');
    pushDel(content.opts, 'system.ntp.server');
  } else {
    pushSet(content.opts, 'system.ntp.enabled', '1');
  }
  pushSet(content.opts, 'system.ntp.enable_server', ntp.enable_server ? '1' : '0');
  if (ntp.use_dhcp === false) pushDel(content.opts, 'system.ntp.enable_server');
  pushList(content.opts, 'system.ntp.server', ntp.server);

  content.opts.push('commit system');
  return content;
}
