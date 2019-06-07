/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const { validate } = require('jsonschema');
const fs = require('fs');
const evrythng = require('evrythng');
const pRetry = require('p-retry');
const { updateLine, printProgress } = require('../util');

/** The account configuration file schema. */
const SCHEMA = require('../../data/account-config.schema.json');
/** Resource types that don't require scope updates. */
const NO_SCOPES = ['project', 'application'];

/**
 * Throw an error if the account configuration loaded does not pass the schema.
 *
 * @param {object} accountConfig - The loaded configuration object.
 */
const validateAccountConfig = (accountConfig) => {
  const validation = validate(accountConfig, SCHEMA);
  if (validation.errors.length) {
    const lines = validation.errors.map(p => p.stack).join('\n');
    throw new Error(`Validation errors:\n${lines}`);
  }
};

/**
 * Map a project name to an ID. If it is not found, an error is thrown.
 *
 * @param {object[]} projects - The projects to search.
 * @param {string} name - Project name to resolve.
 * @returns {string} The project ID, else null.
 */
const mapProjectNameToId = (projects, name) => {
  const found = projects.find(p => p.name === name);
  if (!found) {
    throw new Error(`Project ${name} not found in file.`);
  }

  return found.id;
};

/**
 * Return a task function that creates a given resource.
 * Also performs update for project and user scopes.
 *
 * @param {object} parent - Parent resource or scope.
 * @param {object} payload - The payload to use.
 * @param {string} type - The resource type, property of Operator scope.
 * @returns {function} Function that returns the creation task promise.
 */
const buildCreateTask = (parent, payload, type) => async () => {
  const res = await pRetry(async () => parent[type]().create(payload), { retries: 5 });

  // Scope update not needed or supported
  if (NO_SCOPES.includes(type)) {
    return res;
  }

  // Rescope using resolved scopes
  const updatePayload = { scopes: payload.scopes };
  return pRetry(async () => parent[type](res.id).update(updatePayload), { retries: 5 });
};

/**
 * Like buildCreateTask(), but for PUT requests.
 */
const buildUpdateTask = (parent, payload, type) => async () => parent[type]().update(payload);

/**
 * Sequentially run all create tasks, showing progress.
 *
 * @param {function[]} tasks - List of tasks to run.
 * @param {string} type - Type label to use for progress.
 * @returns {Promise} Promise that resolves to array of all response bodies.
 */
const runTypeTasks = async (tasks, type) => {
  const results = [];
  let errored = false;

  for (const task of tasks) {
    printProgress(`Importing ${type}s`, tasks.indexOf(task), tasks.length);
    try {
      results.push(await task());
    } catch (e) {
      updateLine(`Error for ${type}: ${e.message || e.errors[0]}\n`);
      errored = true;
    }
  }

  updateLine(`Imported ${tasks.length} ${type}s ${errored ? 'with errors': ''}\n`);
  return results;
};

/**
 * Import a list of resources, scoping to project if desired.
 *
 * @param {object} parent - Parent resource or scope.
 * @param {object[]} resources - List of resources to import.
 * @param {string} type - The resource type, property of Operator scope.
 * @param {object[]} projects - The projects to use.
 * @param {boolean} [resolveScopes] - If true, attempt to resolve named project scopes.
 * @returns {Promise} Promise that resolves to array of all task results.
 */
const importResources = async (parent, resources, type, projects, resolveScopes = true) => {
  const tasks = resources.map((item) => {
    if (resolveScopes && item.scopes) {
      // Resolve project names to newly created project IDs
      item.scopes = {
        projects: item.scopes.projects.map(p => mapProjectNameToId(projects, p)),
        users: item.scopes.users || [],
      };
    }

    return buildCreateTask(parent, item, type);
  });

  return runTypeTasks(tasks, type);
};

/**
 * Import all applications to projects named in their scopes.
 *
 * @param {object} operator - The Operator to use.
 * @param {object[]} applications - The applications to import.
 * @param {object[]} projects - The projects to use.
 * @returns {Promise} Promise that resolves to array of all task results.
 */
const importApplications = async (operator, applications, projects) => {
  const tasks = applications.map((item) => {
    const [projectName] = item.scopes.projects;
    const project = projects.find(p => p.name === projectName);

    return buildCreateTask(operator.project(project.id), item, 'application');
  });

  return runTypeTasks(tasks, 'application');
};

/**
 * Build a task function for updating Operator role permissions.
 * This complex object can only be updated permission-by-permission.
 *
 * @param {object} operator - The Operator to use.
 * @param {string} roleId - The role's ID.
 * @param {object[]} permissions - Operator role permissions object.
 * @returns {Promise} Promise that resolves when all permissions are updated.
 */
const buildOperatorPermissionsTask = (operator, roleId, permissions) => async () => {
  const updatePermission = (name, data) => evrythng.api({
    url: `/roles/${roleId}/permissions/${name}`,
    apiKey: operator.apiKey,
    method: 'put',
    data,
  });

  for (const p of permissions) {
    await updatePermission(p.name, p);

    for (const c of p.children) {
      await updatePermission(c.name, c);
    }
  }
};

/**
 * Import all permissions for all roles.
 *
 * @param {object} operator - The Operator to use.
 * @param {object[]} newRoles - List of roles objects.
 * @param {object[]} originalRoles - List of original roles, containing 'permissions'.
 * @returns {Promise} Promise that resolves to array of all task results.
 */
const importRolePermissions = async (operator, newRoles, originalRoles) => {
  const tasks = newRoles.map((newRole) => {
    // Find the right originalRole with permissions for this new role's name
    const { permissions } = originalRoles.find(p => p.name === newRole.name);

    // App User roles
    if (permissions[0].path) {
      return buildUpdateTask(operator.role(newRole.id), permissions, 'permission');
    }

    // Operator roles
    if (permissions[0].name) {
      return buildOperatorPermissionsTask(operator, newRole.id, permissions);
    }

    throw new Error(`Unknown permissions type!\n${JSON.stringify(permissions)}`);
  });

  return runTypeTasks(tasks, 'permission');
};

/**
 * Import resources into the current operator's account.
 *
 * @param {string} jsonFile - Path to the JSON file to load.
 * @param {object} operator - The Operator scope to do the loading.
 */
const importFromFile = async (jsonFile, operator) => {
  if (!jsonFile) {
    throw new Error('Please specify $jsonFile to an input file.');
  }

  const accountConfig = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  validateAccountConfig(accountConfig);
  console.log('File is valid\n');

  const {
    applications, products, actionTypes, places,
  } = accountConfig;
  let { projects, roles } = accountConfig;

  // roles are used for role creation, originalRoles for role permission assignment
  let originalRoles = JSON.parse(JSON.stringify(roles));
  roles.forEach(p => delete p.permissions);

  // Update resources with ones imported
  projects = await importResources(operator, projects, 'project', projects, false);
  roles = await importResources(operator, roles, 'role', projects);

  await importApplications(operator, applications, projects);
  await importResources(operator, products, 'product', projects);
  await importResources(operator, actionTypes, 'actionType', projects);
  await importResources(operator, places, 'place', projects);
  await importRolePermissions(operator, roles, originalRoles);

  console.log('\nImport complete!');
};

module.exports = {
  importFromFile,
  validateAccountConfig,
  mapProjectNameToId,
  buildCreateTask,
  buildUpdateTask,
  runTypeTasks,
  importResources,
  importApplications,
  buildOperatorPermissionsTask,
  importRolePermissions,
};
