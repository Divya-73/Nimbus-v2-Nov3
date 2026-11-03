
// OpenSearch index names
export const INDICES = {
    USERS: 'access',
    LOGIN_LOGS: 'loginlog',
    DEVICES: 'devices',
    ORGANIZATIONS :  'org',
    BRANCHES: 'branch',
    NETWORKS: 'branchnet',
    MODELS: 'models',
    ALARMS: 'alarm',
    ALARM_CONFIG: 'alarmconf',
    ALARM_LOGS: 'alarmlog',
    LTE_DETAILS: 'ltetrans',
    AGENTS_DETAILS: 'agents',
    TRAFFIC_DETAILS: 'nettrans',
    CPU_MEMORY_DETAILS: 'systrans',
    JITTER_LATENCY_DETAILS: 'twtrans',
    APPLICATION_DETAILS: 'flows',
    TASKS_DETAILS: 'tasks',
    TASKS_LOGS: 'tasklog',
    DEVICE_DETAILS: 'ahtrans',
    DEVICE_DELETION_LOGS: 'device_deleted_logs',
    DISK_DETAILS: 'dftrans',
    TEMPLATES: 'template',
    GROUP_CONF: 'group_conf',
    GROUP_ACTION: 'group_action',
    SYSLOG: 'syslog-*',
  };
    
  // User roles
  export const USER_ROLES = {
    SUPER_ADMIN: '99',
    ADMIN: '7',
    USER: '1',
    VIEWER: '11',
  };
  
  // User status
  export const USER_STATUS = {
    ACTIVE: '1',
    INACTIVE: '0',
  };