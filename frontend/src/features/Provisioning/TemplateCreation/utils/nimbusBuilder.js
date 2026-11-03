import { emptyContent, pushDel, pushList, pushSet } from './uci';

export function defaultNimbusForm(ttype = 'nimbus') {
  return {
    tempName: '',
    ttype,
    aheesaNMC: {
      enabled: true,
      agentId: '',
      orgId: '',
      branchId: '',
      tags: '',
      esrv: '',
      eusrpwd: '',
      msrv: '',
      mport: '',
      muser: '',
      mpass: '',
      mtopic: '',
      sf: '',
      flsys: true,
      flcpu: false,
      flnet: true,
      flps: false,
      fldf: false,
      fllte: false,
      flhk: false,
      fltw: false,
      flse: false,
    },
    aheesaFM: {
      enabled: true,
      agentId: '',
      orgId: '',
      branchId: '',
      tags: 'nimbus',
      esrv: '',
      eusrpwd: '',
      iface: [],
    },
  };
}

export function buildNimbusContent(formObj = {}) {
  const nmc = formObj.aheesaNMC || {};
  const fm = formObj.aheesaFM || {};
  const content = emptyContent({
    stop: [],
    start: ['aheesaFM', 'aheesaNMC'],
    formValue: formObj,
  });

  Object.entries(nmc).forEach(([key, value]) => {
    if (key === 'enabled' && value === false) {
      pushDel(content.opts, 'aheesaNMC.globals.enabled');
      return;
    }
    pushSet(content.opts, `aheesaNMC.globals.${key}`, value === true ? '1' : value === false ? '0' : value);
  });

  pushDel(content.opts, 'aheesaFM.globals.iface');
  Object.entries(fm).forEach(([key, value]) => {
    if (key === 'iface') {
      pushList(content.opts, 'aheesaFM.globals.iface', value);
      return;
    }
    if (key === 'enabled' && value === false) {
      pushDel(content.opts, 'aheesaFM.globals.enabled');
      return;
    }
    pushSet(content.opts, `aheesaFM.globals.${key}`, value === true ? '1' : value === false ? '0' : value);
  });

  content.opts.push('commit aheesaFM');
  content.opts.push('commit aheesaNMC');
  return content;
}
