const { expect } = require('chai');
const evrythng = require('evrythng');
const nock = require('nock');
const read = require('../src/modules/read');
const _export = require('../src/modules/export');
const _import = require('../src/modules/import');
const compare = require('../src/modules/compare');
const util = require('../src/util');

const {
  testProjects,
  testProducts,
  testPermissions,
  testRoles,
  testCurrentAccount,
  testOtherAccount,
} = require('./testData');

const DUMMY_API_KEY = '9'.repeat(80);

/**
 * Prepare nock for an API request.
 *
 * @param {boolean} allowUnmocked - Allow nock to make unmocked requests to the API.
 * @returns {Object} nock scope object.
 */
const mockApi = (allowUnmocked = false) => nock('https://api.evrythng.com', { allowUnmocked });

describe('evrythng-cli-plugin-account-config', () => {
  let scope;

  before(async () => {
    mockApi()
      .get('/access')
      .reply(200, { actor: { id: 'fakeId' }})
      .persist()
    scope = new evrythng.Operator(DUMMY_API_KEY);
  });

  describe('read.js', () => {
    it('should export readAccount method', async () => {
      expect(read.readAccount).to.be.a('function');
    });

    it('should map a project ID to project name', async () => {
      const id = 'UmSqCDt5BD8atKRRagdqUnAa';

      expect(read.mapProjectName(testProjects, id)).to.equal(testProjects[1].name);
    });

    it('should map unknown project ID to same ID', async () => {
      const id = 'unknownId';

      expect(read.mapProjectName(testProjects, id)).to.equal(id);
    });

    it('should map a product ID to product name', async () => {
      const id = 'AapscG7ctXwDcMwwwF5EwKsh';

      expect(read.getProductName(testProducts, id)).to.equal(testProducts[1].name);
    });

    it('should map unknown product ID to same ID', async () => {
      const id = 'unknownId';

      expect(read.getProductName(testProducts, id)).to.equal(id);
    });

    it('should request all resources of a type', async () => {
      mockApi()
        .get('/projects?perPage=100&withScopes=true')
        .reply(200, []);

      const res = await read.getAllResources(scope, 'project', null, false);
      expect(res).to.be.an('array');
    });

    it('should request all resources of a sub-type', async () => {
      mockApi()
        .get('/projects/U6tDee5bpWMWKWawwGNNtdpt/applications?perPage=100&withScopes=true')
        .reply(200, []);

      const res = await read.getAllResources(
        scope.project('U6tDee5bpWMWKWawwGNNtdpt'),
        'application',
        null,
        false
      );
      expect(res).to.be.an('array');
    });

    it('should request all applications for a project', async () => {
      mockApi()
        .get(`/projects/${testProjects[0].id}/applications?perPage=100&withScopes=true`)
        .reply(200, []);
      mockApi()
        .get(`/projects/${testProjects[1].id}/applications?perPage=100&withScopes=true`)
        .reply(200, []);

      const res = await read.getProjectApplications(scope, testProjects, testProjects[0]);
      expect(res).to.be.an('array');
    });

    it('should request all applications for some projects', async () => {

      mockApi()
        .get(`/projects/${testProjects[0].id}/applications?perPage=100&withScopes=true`)
        .reply(200, []);
      mockApi()
        .get(`/projects/${testProjects[1].id}/applications?perPage=100&withScopes=true`)
        .reply(200, []);

      const res = await read.getAllApplications(scope, testProjects);
      expect(res).to.be.an('array');
    });

    it('should request all permissions for some roles', async () => {
      const roles = [
        { name: 'Role 1', id: 'UKpscG7ctXwDcMwwwF5EwKsh' },
        { name: 'Role 2', id: 'UmSqCDt5BD8atKRRagdqUnAa' },
      ];

      mockApi()
        .get(`/roles/${roles[0].id}/permissions`)
        .reply(200, [{ access: 'cru', path: '/thngs' }]);
      mockApi()
        .get(`/roles/${roles[1].id}/permissions`)
        .reply(200, [{ access: 'cru', path: '/products' }]);

      await read.getAllRolePermissions(scope, roles);
      expect(roles[0].permissions).to.be.an('array');
      expect(roles[0].permissions[0].access).to.equal('cru');
      expect(roles[0].permissions[0].path).to.equal('/thngs');
      expect(roles[1].permissions).to.be.an('array');
      expect(roles[1].permissions[0].access).to.equal('cru');
      expect(roles[1].permissions[0].path).to.equal('/products');
    });
  });

  describe('export.js', () => {
    it('should export exportToFile method', async () => {
      expect(_export.exportToFile).to.be.a('function');
    });

    it('should validate a type list', async () => {
      const typeList = 'projects,places';
      const expected = ['places'];
      expect(_export.parseTypeList(typeList)).to.deep.equal(expected);
    });

    it('should validate an empty type list', async () => {
      const typeList = '';
      expect(() => _export.parseTypeList(typeList)).to.throw();
    });

    it('should validate an invalid type list', async () => {
      const typeList = 'products';
      expect(() => _export.parseTypeList(typeList)).to.throw();
    });
  });

  describe('import.js', () => {
    it('should export importFromFile method', async () => {
      expect(_import.importFromFile).to.be.a('function');
    });

    it('should map project name to known ID', async () => {
      const result = _import.mapProjectNameToId(testProjects, 'Project 2');
      expect(result).to.equal('UmSqCDt5BD8atKRRagdqUnAa');
    });

    it('should throw for unknown project name', async () => {
      const attempt = () => _import.mapProjectNameToId(testProjects, 'Project Unknown');
      expect(attempt).to.throw();
    });

    it('should build a creation task', async () => {
      const payload = { name: 'test', scopes: {} };

      const task = _import.buildCreateTask(scope, payload, 'product');
      expect(task).to.be.a('function');

      mockApi()
        .post('/products', payload)
        .reply(201, { id: 'foo' });
      mockApi()
        .put('/products/foo', { scopes: {} })
        .reply(200, {});

      const res = await task();
      expect(res).to.be.an('object');
    });

    it('should build an upsert task', async () => {
      const payload = { name: 'test' };
      const task = _import.buildUpsertTask(scope, payload, 'product');
      expect(task).to.be.a('function');

      mockApi()
        .get('/products?filter=name%3Dtest')
        .reply(200, [{ id: 'foo' }])
      mockApi()
        .put('/products/foo', payload)
        .reply(200, { id: 'foo', name: 'foo' });

      const res = await task();
      expect(res).to.be.an('object');
    });

    it('should run a series of tasks', async () => {
      const payloads = [
        { name: 'Product 1' },
        { name: 'Product 2' },
        { name: 'Product 3' },
      ];
      const tasks = payloads.map(p => _import.buildCreateTask(scope, p, 'product'));

      mockApi()
        .post('/products', payloads[0])
        .reply(201, { id: 'foo' })
      mockApi()
        .put('/products/foo')
        .reply(200, {})
      mockApi()
        .post('/products', payloads[1])
        .reply(201, { id: 'foo' })
      mockApi()
        .put('/products/foo')
        .reply(200, {})
      mockApi()
        .post('/products', payloads[2])
        .reply(201, { id: 'foo' })
      mockApi()
        .put('/products/foo')
        .reply(200, {})

      const res = await _import.runTasks(tasks, 'product');
      expect(res).to.be.an('array');
    });

    it('should import some resources', async () => {
      const resources = [{ name: 'Product 1', scopes: {} }];

      mockApi()
        .post('/products', resources[0])
        .reply(201, { id: 'foo' });
      mockApi()
        .put('/products/foo', { scopes: {} })
        .reply(200, {});

      const res = await _import.importResources(scope, resources, 'product', null, false);
      expect(res).to.be.an('array');
    });

    it('should import some resources with scopes', async () => {
      const resources = [{
        name: 'Product 1',
        scopes: { projects: ['Project 2'] },
      }];

      mockApi()
        .post('/products', resources[0])
        .reply(201, { id: 'foo' });
      mockApi()
        .put('/products/foo', {
          scopes: {
            projects: ['UmSqCDt5BD8atKRRagdqUnAa'],
            users: [],
          },
        })
        .reply(200, {});

      const res = await _import.importResources(scope, resources, 'product', testProjects);
      expect(res).to.be.an('array');
    });

    it('should import applications', async () => {
      const applications = [
        { name: 'App 1', scopes: { projects: ['Project 2'] } },
      ];

      mockApi()
        .post('/projects/UmSqCDt5BD8atKRRagdqUnAa/applications', applications[0])
        .reply(201, {});

      const res = await _import.importApplications(scope, applications, testProjects);
      expect(res).to.be.an('array');
    });

    it('should build an Operator permissions task', async () => {
      const task = _import.buildOperatorPermissionsTask(scope, 'foo', testPermissions);
      expect(task).to.be.a('function');

      for (const p of testPermissions) {
        mockApi().put(`/roles/foo/permissions/${p.name}`, p).reply(200, []);

        for (const c of p.children) {
          mockApi().put(`/roles/foo/permissions/${c.name}`, c).reply(200, []);
        }
      }

      await task();
    });

    it('should import role permissions', async () => {
      const originalRoles = JSON.parse(JSON.stringify(testRoles));

      mockApi().put('/roles/appUserRoleId/permissions', testRoles[0].permissions).reply(200, []);

      for (const p of testRoles[1].permissions) {
        mockApi().put(`/roles/operatorRoleId/permissions/${p.name}`, p).reply(200, []);

        for (const c of p.children) {
          mockApi().put(`/roles/operatorRoleId/permissions/${c.name}`, c).reply(200, []);
        }
      }

      const res = await _import.importRolePermissions(scope, testRoles, originalRoles);
      expect(res).to.be.an('array');
    });
  });

  describe('compare.js', () => {
    it('should export compareAccounts method', async () => {
      expect(compare.compareAccounts).to.be.a('function');
    });

    it('should compare a given type of resources', async () => {
      const diffType = compare.diffType(testCurrentAccount, testOtherAccount, 'roles');

      expect(diffType).to.be.an('array');
      expect(diffType).to.have.length(2);
    });

    it('should compare role permissions', async () => {
      const current = {
        roles: [{
          name: 'role 1',
          version: 2,
          type: 'userInApp',
          permissions: [
            { access: 'cru', path: '/thngs' },
            { access: 'c', path: '/products' },
          ],
        }],
      };
      const other = {
        roles: [{
          name: 'role 1',
          version: 2,
          type: 'userInApp',
          permissions: [
            { access: 'cru', path: '/thngs' },
          ],
        }],
      };
      const diffType = compare.diffType(current, other, 'roles');

      expect(diffType).to.be.an('array');
      expect(diffType).to.have.length(1);
    });

    it('should generate diff of two accounts', async () => {
      const diff = compare.generateObjectDiff(testCurrentAccount, testOtherAccount);

      expect(diff).to.be.an('object');
      expect(diff.projects).to.be.an('array');
      expect(diff.projects).to.have.length(1);
      expect(diff.applications).to.be.an('array');
      expect(diff.applications).to.have.length(1);
      expect(diff.places).to.be.an('array');
      expect(diff.places).to.have.length(0);
      expect(diff.actionTypes).to.be.an('array');
      expect(diff.actionTypes).to.have.length(2);
      expect(diff.products).to.be.an('array');
      expect(diff.products).to.have.length(0);
      expect(diff.roles).to.be.an('array');
      expect(diff.roles).to.have.length(2);
    });
  });

  describe('util.js', () => {
    it('should validate a configuration', async () => {
      const config = {
        projects: [{ name: 'test '}],
        applications: [{ name: 'test' }],
        products: [],
        actionTypes: [{ name: '_Test' }],
        places: [],
        roles: [],
        thngs: [],
      };

      expect(() => util.validateAccountConfig(config)).to.not.throw();
    });

    it('should validate a bad configuration', async () => {
      const config = {
        projects: [],
        foo: 'bar',
      };

      expect(() => util.validateAccountConfig(config)).to.throw();
    });
  })
});
