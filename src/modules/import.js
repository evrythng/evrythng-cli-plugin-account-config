/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const fs = require('fs');
const evrythng = require('evrythng');
const { updateLine, printProgress, validateAccountConfig } = require('../util');


/** Resource types that don't require scope updates. */
const NO_SCOPES = ['project', 'application'];

let willUpdate;

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
    throw new Error(`Project ${name} not found in file. It may not exist or was not exported.`);
  }

  return found.id;
};

/**
 * Return a task function that creates a given resource.
 * Also performs update for project and user scopes if appropriate.
 */
const buildCreateTask = (parent, payload, type) => async () => {
  const res = await parent[type]().create(payload);
  return NO_SCOPES.includes(type)
    ? res
    : parent[type](type === 'actionType' ? res.name : res.id)
      .update({ scopes: payload.scopes });
};

/**
 * Like buildCreateTask(), but performs updates. First checks by name and
 * updates if found.
 */
const buildUpsertTask = (parent, payload, type) => async () => {
  const params = { filter: `name=${payload.name}` };
  const found = await parent[type]().read({ params });
  if (found.length > 1) {
    throw new Error(`More than one resource found for ${type} ${payload.name}`);
  }

  if (NO_SCOPES.includes(type)) {
    delete payload.scopes;
  }

  const [res] = found;
  return found.length
    ? parent[type](type === 'actionType' ? res.name : res.id).update(payload)
    : buildCreateTask(parent, payload, type)();
};

/**
 * Return either buildCreateTask or buildUpsertTask depending on willUpdate.
 *
 * @param {object} parent - Parent resource or scope.
 * @param {object} payload - The payload to use.
 * @param {string} type - The resource type, property of Operator scope.
 * @returns {function} Function that returns the creation task Promise.
 */
const buildTask = (parent, payload, type) => {
  const func = willUpdate ? buildUpsertTask : buildCreateTask;
  return func(parent, payload, type);
};

/**
 * Sequentially run all create tasks, showing progress.
 *
 * @param {function[]} tasks - List of tasks to run.
 * @param {string} type - Type label to use for progress.
 * @returns {Promise} Promise that resolves to array of all response bodies.
 */
const runTasks = async (tasks, type) => {
  const results = [];
  let errored = false;

  for (const task of tasks) {
    printProgress(`Importing ${type}s`, tasks.indexOf(task), tasks.length);
    try {
      results.push(await task());
    } catch (e) {
      updateLine(`Error for ${type}: ${e.stack || e.errors[0]}\n`);
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

    return buildTask(parent, item, type);
  });

  return runTasks(tasks, type);
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
    if (!project) {
      throw new Error(`No project '${projectName}' found for application ${item.name}`);
    }

    return buildTask(operator.project(project.id), item, 'application');
  });

  return runTasks(tasks, 'application');
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
  /**
   * Update permissions for a named Operator permission, such as 'global_read'.
   *
   * @param {string} name - Name of the permission.
   * @param {object} data - Permission update payload.
   * @returns {Promise}
   */
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
 * @param {object[]} newRoles - List of roles objects just created as part of import.
 * @param {object[]} rolesWPerms - List of original roles, containing 'permissions'.
 * @returns {Promise} Promise that resolves to array of all task results.
 */
const importRolePermissions = async (operator, newRoles, rolesWPerms) => {
  const tasks = newRoles.map((newRole) => {
    // Find the right originalRole with permissions for this new role's name
    const { permissions } = rolesWPerms.find(p => p.name === newRole.name);

    return permissions[0].path
      // App User roles
      ? async () => operator.role(newRole.id).permission().update(permissions)
      // Operator roles
      : buildOperatorPermissionsTask(operator, newRole.id, permissions);
  });

  return runTasks(tasks, 'permission');
};

/**
 * Import resources into the current operator's account.
 *
 * @param {string} jsonFile - Path to the JSON file to load.
 * @param {string} updateArg - 'update' parameter to update by name.
 * @param {object} operator - The Operator scope to do the loading.
 */
const importFromFile = async (jsonFile, updateArg, operator) => {
  if (!jsonFile) {
    throw new Error('Please specify $jsonFile to an input file.');
  }

  willUpdate = updateArg === 'update';
  if (willUpdate) {
    console.log('\n\'update\' was specified, will update by \'name\'. This will take longer.\n');
  }

  const accountConfig = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  validateAccountConfig(accountConfig);

  const { applications, products, actionTypes, places, roles } = accountConfig;
  const rolesWPerms = JSON.parse(JSON.stringify(roles));
  let { projects } = accountConfig;

  projects = await importResources(operator, projects, 'project', projects, false);
  await importApplications(operator, applications, projects);
  await importResources(operator, products, 'product', projects);
  await importResources(operator, actionTypes, 'actionType', projects);
  await importResources(operator, places, 'place', projects);

  roles.forEach(p => delete p.permissions);
  const newRoles = await importResources(operator, roles, 'role', projects);
  await importRolePermissions(operator, newRoles, rolesWPerms);

  console.log('\nImport complete!');
};

module.exports = {
  importFromFile,
  mapProjectNameToId,
  buildCreateTask,
  buildUpsertTask,
  runTasks,
  importResources,
  importApplications,
  buildOperatorPermissionsTask,
  importRolePermissions,
};
