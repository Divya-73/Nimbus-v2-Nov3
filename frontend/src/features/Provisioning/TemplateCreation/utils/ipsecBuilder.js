import { commitOnlyContent, emptyContent, hasNamedItems, isFilled, pushList, pushSet } from './uci';

function safeName(value, fallback = 'item') {
  const name = String(value || fallback || '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_');
  return name || fallback;
}

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => v !== '' && v != null);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function defaultIpsecForm(ttype = 'ipsec') {
  return {
    tempName: '',
    ttype,
    overWrite: false,
    cryptoProposals: [],
    tunnelNetworks: [],
    tunnelInterfaces: [],
    bypassLan: [],
    tunnelConfigs: [],
  };
}

export function buildIpsecContent(formObj = {}) {
  const stop = ['ahipsec', 'swanctl', 'firewall'];
  const start = ['firewall', 'ahipsec', 'swanctl'];
  const hasConfig =
    formObj.overWrite ||
    hasNamedItems(formObj.cryptoProposals) ||
    hasNamedItems(formObj.tunnelNetworks) ||
    hasNamedItems(formObj.tunnelConfigs) ||
    hasNamedItems(formObj.tunnelInterfaces) ||
    hasNamedItems(formObj.bypassLan);

  if (!hasConfig) {
    return commitOnlyContent({ formValue: formObj });
  }

  const content = emptyContent({
    stop,
    trunc: formObj.overWrite ? ['ipsec'] : [],
    start,
    formValue: formObj,
  });

  if (formObj.overWrite) {
    content.opts.push(`commit && ubus call uci delete '{"config":"ipsec"}'`);
  }

  content.opts.push('set ipsec.ipsec=ipsec');
  content.opts.push(`add_list ipsec.ipsec.listen=''`);

  for (const proposal of formObj.cryptoProposals || []) {
    const name = safeName(proposal.name, 'strong');
    content.opts.push(`set ipsec.${name}='crypto_proposal'`);
    pushSet(content.opts, `ipsec.${name}.encryption_algorithm`, proposal.encryption_algorithm);
    pushSet(content.opts, `ipsec.${name}.hash_algorithm`, proposal.hash_algorithm);
    pushSet(content.opts, `ipsec.${name}.dh_group`, proposal.dh_group);
    pushSet(content.opts, `ipsec.${name}.prf_algorithm`, proposal.prf_algorithm);
  }

  for (const network of formObj.tunnelNetworks || []) {
    const name = safeName(network.name, 'tunnel1');
    content.opts.push(`set ipsec.${name}='tunnel'`);
    pushList(content.opts, `ipsec.${name}.local_subnet`, asList(network.local_subnet));
    pushList(content.opts, `ipsec.${name}.remote_subnet`, asList(network.remote_subnet));
    pushList(content.opts, `ipsec.${name}.crypto_proposal`, asList(network.crypto_proposal));
    pushSet(content.opts, `ipsec.${name}.local_nat`, network.local_nat);
    pushSet(content.opts, `ipsec.${name}.startaction`, network.startaction);
    pushSet(content.opts, `ipsec.${name}.dpdaction`, network.dpdaction);
    pushSet(content.opts, `ipsec.${name}.closeaction`, network.closeaction);
    pushSet(content.opts, `ipsec.${name}.lifetime`, network.lifetime);
    content.opts.push(`set ipsec.${name}.rekeytime='${network.rekeytime ?? ''}'`);
    pushSet(content.opts, `ipsec.${name}.if_id`, network.if_id);
    pushSet(content.opts, `ipsec.${name}.priority`, network.priority);
    pushSet(content.opts, `ipsec.${name}.ipcomp`, network.ipcomp ? '1' : '');
    if (network.hw_offload) pushSet(content.opts, `ipsec.${name}.hw_offload`, network.hw_offload);
    else content.opts.push(`delete ipsec.${name}.hw_offload`);
  }

  for (const iface of formObj.tunnelInterfaces || []) {
    const type = iface.type === 'xfrm' ? 'xfrm' : 'vti';
    const name = safeName(iface.name, `${type}1`);
    content.opts.push(`set ipsec.${name}='${type}'`);
    pushSet(content.opts, `ipsec.${name}.key`, iface.key);
    pushSet(content.opts, `ipsec.${name}.local`, iface.local);
    pushSet(content.opts, `ipsec.${name}.remote`, iface.remote);
    pushSet(content.opts, `ipsec.${name}.dev`, iface.dev);
    pushList(content.opts, `ipsec.${name}.local_virtual_ip`, asList(iface.local_virtual_ip));
    pushList(content.opts, `ipsec.${name}.route`, asList(iface.routes));
  }

  for (const bypass of formObj.bypassLan || []) {
    const name = safeName(bypass.name, 'bypass1');
    content.opts.push(`set ipsec.${name}='bypass'`);
    pushList(content.opts, `ipsec.${name}.local_subnet`, asList(bypass.local_subnet));
    pushList(content.opts, `ipsec.${name}.remote_subnet`, asList(bypass.remote_subnet));
    pushSet(content.opts, `ipsec.${name}.startaction`, bypass.startaction);
  }

  for (const remote of formObj.tunnelConfigs || []) {
    const name = safeName(remote.name, 'remote1');
    const wan = asList(remote.local_iface)[0] || 'wan1';
    content.opts.push(`set ipsec.${name}='remote'`);
    pushSet(content.opts, `ipsec.${name}.enabled`, remote.enabled === false ? '0' : '1');
    pushSet(content.opts, `ipsec.${name}.keyexchange`, remote.keyexchange || 'ikev1');
    pushSet(content.opts, `ipsec.${name}.authentication_method`, remote.authentication_method || 'psk');
    pushSet(content.opts, `ipsec.${name}.pre_shared_key`, remote.pre_shared_key);
    pushSet(content.opts, `ipsec.${name}.gateway`, remote.gateway);
    pushSet(content.opts, `ipsec.${name}.dpddelay`, remote.dpddelay);
    pushSet(content.opts, `ipsec.${name}.dpdtimeout`, remote.dpdtimeout);
    pushSet(content.opts, `ipsec.${name}.fragmentation`, remote.fragmentation || 'yes');
    pushSet(content.opts, `ipsec.${name}.mobike`, remote.mobike ? '1' : '');
    pushList(content.opts, `ipsec.${name}.local_iface`, asList(remote.local_iface));
    pushList(content.opts, `ipsec.${name}.crypto_proposal`, asList(remote.crypto_proposal));
    pushList(content.opts, `ipsec.${name}.tunnel`, asList(remote.tunnel));
    pushList(content.opts, `ipsec.${name}.bypass`, asList(remote.bypass));
    pushSet(content.opts, `ipsec.${name}.exchange_mode`, remote.ike_mode);
    pushSet(content.opts, `ipsec.${name}.local_gateway`, remote.local_gateway);
    pushList(content.opts, `ipsec.${name}.local_sourceip`, asList(remote.local_sourceip));
    pushList(content.opts, `ipsec.${name}.local_ip`, asList(remote.local_ip));
    pushSet(content.opts, `ipsec.${name}.local_identifier`, remote.local_identifier);
    pushSet(content.opts, `ipsec.${name}.remote_identifier`, remote.remote_identifier);
    pushSet(content.opts, `ipsec.${name}.keyingtries`, remote.keyingtries);
    pushSet(content.opts, `ipsec.${name}.rekeytime`, remote.retransmit_timeout);
    pushSet(content.opts, `ipsec.${name}.over_time`, remote.over_time);

    content.opts.push(`set firewall.ipsec_ike='rule'`);
    pushSet(content.opts, 'firewall.ipsec_ike.name', 'Allow-IPSec-IKE');
    pushSet(content.opts, 'firewall.ipsec_ike.src', wan);
    pushSet(content.opts, 'firewall.ipsec_ike.proto', 'udp');
    pushSet(content.opts, 'firewall.ipsec_ike.dest_port', '500 4500');
    pushSet(content.opts, 'firewall.ipsec_ike.target', 'ACCEPT');
    content.opts.push(`set firewall.ipsec_esp='rule'`);
    pushSet(content.opts, 'firewall.ipsec_esp.name', 'Allow-IPSec-ESP');
    pushSet(content.opts, 'firewall.ipsec_esp.src', wan);
    pushSet(content.opts, 'firewall.ipsec_esp.proto', 'esp');
    pushSet(content.opts, 'firewall.ipsec_esp.target', 'ACCEPT');
    content.opts.push(`set firewall.ipsec_forward='rule'`);
    pushSet(content.opts, 'firewall.ipsec_forward.name', 'Allow-IPSec-Forward');
    pushSet(content.opts, 'firewall.ipsec_forward.src', 'lan');
    pushSet(content.opts, 'firewall.ipsec_forward.dest', wan);
    pushSet(content.opts, 'firewall.ipsec_forward.target', 'ACCEPT');
  }

  content.opts.push(
    `commit ipsec && ubus call luci setInitAction '{"name":"ipsec", "action":"restart"}'`
  );
  content.opts.push(
    `commit firewall && ubus call luci setInitAction '{"name":"firewall", "action":"restart"}'`
  );
  content.opts.push(`ubus call luci setInitAction '{"name":"swanctl", "action":"restart"}'`);
  return content;
}
