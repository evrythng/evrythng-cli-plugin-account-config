const testProjects = [
  { name: 'Project 1', id: 'UKpscG7ctXwDcMwwwF5EwKsh' },
  { name: 'Project 2', id: 'UmSqCDt5BD8atKRRagdqUnAa' },
];

const testPermissions = [{
  name: 'global_read',
  enabled: false,
  projectScoped: false,
  children: [{
    name: 'gl_resource_update',
    enabled: false,
    projectScoped: false,
  }, {
    name: 'gl_project_update',
    enabled: false,
    projectScoped: false,
  }],
}, {
  name: 'project_read',
  enabled: false,
  projectScoped: true,
  projects: [],
  children: [{
    name: 'project_update',
    enabled: false,
    projectScoped: true,
    projects: [],
  }, {
    name: 'project_resource_update',
    enabled: false,
    projectScoped: true,
    projects: [],
  }],
}];

const testRoles = [{
  id: 'appUserRoleId',
  name: 'app user role',
  version: 2,
  type: 'userInApp',
  permissions: [
    { access: 'cru', path: '/thngs' },
    { access: 'c', path: '/products' },
  ],
}, {
  id: 'operatorRoleId',
  name: 'operator role',
  permissions: testPermissions,
}];

const testCurrentAccount = {
  projects: [
    { name: 'Project 1' },
    { name: 'Other Project' },
  ],
  applications: [{
    name: 'App 1',
    socialNetworks: {},
    scopes: { projects: ['Project 1'] },
  }, {
    name: 'Other App',
    socialNetworks: {},
    scopes: { projects: ['Other Project'] },
  }],
  places: [{ name: 'Place 1' }],
  actionTypes: [
    { name: '_MyTestType' },
    { name: '_AnotherActionType' },
  ],
  products: [],
  roles: testRoles,
};

const testOtherAccount = {
  projects: [{ name: 'Project 1' }],
  applications: [{
    name: 'App 1',
    socialNetworks: {},
    scopes: { projects: ['Project 1'] },
  }],
  places: [{ name: 'Place 1' }],
  actionTypes: [],
  products: [],
  roles: [],
};

module.exports = {
  testProjects,
  testPermissions,
  testRoles,
  testCurrentAccount,
  testOtherAccount,
};
