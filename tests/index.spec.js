const { expect } = require('chai');
const evrythng = require('evrythng');
const nock = require('nock');
const read = require('../src/modules/read');
const _export = require('../src/modules/export');
const _import = require('../src/modules/import');
const compare = require('../src/modules/compare');

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

  describe('read', () => {
    it('should export readAccount method', async () => {
      expect(read.readAccount).to.be.a('function');
    });

    it('should map a project ID to project name', async () => {
      const id = 'UmSqCDt5BD8atKRRagdqUnAa';
      const projects = [
        { name: 'Project 1', id: 'UKpscG7ctXwDcMwwwF5EwKsh' },
        { name: 'Project 2', id: 'UmSqCDt5BD8atKRRagdqUnAa' },
      ];

      expect(read.mapProjectName(projects, id)).to.equal(projects[1].name);
    });

    it('should map unknown project ID to same ID', async () => {
      const id = 'UmSqCDt5BD8atKRRagdqUnAa';
      const projects = [{
        name: 'Project 1',
        id: 'UKpscG7ctXwDcMwwwF5EwKsh',
      }];

      expect(read.mapProjectName(projects, id)).to.equal(id);
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
      const projects = [
        { name: 'Project 1', id: 'UKpscG7ctXwDcMwwwF5EwKsh' },
        { name: 'Project 2', id: 'UmSqCDt5BD8atKRRagdqUnAa' },
      ];

      mockApi()
        .get(`/projects/${projects[0].id}/applications?perPage=100&withScopes=true`)
        .reply(200, []);
      mockApi()
        .get(`/projects/${projects[1].id}/applications?perPage=100&withScopes=true`)
        .reply(200, []);

      const res = await read.getProjectApplications(scope, projects, projects[0]);
      expect(res).to.be.an('array');
    });

    it('should request all applications for some projects', async () => {
      const projects = [
        { name: 'Project 1', id: 'UKpscG7ctXwDcMwwwF5EwKsh' },
        { name: 'Project 2', id: 'UmSqCDt5BD8atKRRagdqUnAa' },
      ];

      mockApi()
        .get(`/projects/${projects[0].id}/applications?perPage=100&withScopes=true`)
        .reply(200, []);
      mockApi()
        .get(`/projects/${projects[1].id}/applications?perPage=100&withScopes=true`)
        .reply(200, []);

      const res = await read.getAllApplications(scope, projects);
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

  describe('export', () => {
    it('should export exportToFile method', async () => {
      expect(_export.exportToFile).to.be.a('function');
    });
  });

  describe('import', () => {
    it('should export importFromFile method', async () => {
      expect(_import.importFromFile).to.be.a('function');
    });

    it('should validate a configuration', async () => {
      const config = {
        projects: [{ name: 'test '}],
        applications: [{ name: 'test' }],
        products: [],
        actionTypes: [{ name: '_Test' }],
        places: [],
        roles: [],
      };

      expect(() => _import.validateAccountConfig(config)).to.not.throw();
    });

    it('should validate a bad configuration', async () => {
      const config = {
        projects: [],
        foo: 'bar',
      };

      expect(() => _import.validateAccountConfig(config)).to.throw();
    });

    it('should map project name to known ID', async () => {
      const projects = [
        { name: 'Project 1', id: 'UKpscG7ctXwDcMwwwF5EwKsh' },
        { name: 'Project 2', id: 'UmSqCDt5BD8atKRRagdqUnAa' },
      ];

      expect(_import.mapProjectNameToId(projects, 'Project 2'));
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

    it('should build an update task', async () => {
      const payload = { name: 'test' };
      const task = _import.buildUpdateTask(scope, payload, 'product');

      expect(task).to.be.a('function');

      mockApi()
        .put('/products', payload)
        .reply(200, {});
      const res = await task();

      expect(res).to.be.an('object');
    });
  });

  describe('compare', () => {
    it('should export compareAccounts method', async () => {
      expect(compare.compareAccounts).to.be.a('function');
    });
  });
});
