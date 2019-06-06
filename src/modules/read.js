/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const pRetry = require('p-retry');

let unknownProjects = [];

/** The default roles in every account */
const DEFAULT_ROLES = [
  "admin",
  "none",
  "Base Application User"
];
/** The default action types in every account */
const DEFAULT_ACTION_TYPES = [
  "checkins",
  "commissions",
  "decommissions",
  "encodings",
  "implicitScans",
  "invalidScans",
  "scans",
  "shares"
];

/**
 * Map a project ID to a known project name, or else leave as is.
 *
 * @param {object[]} projects - The projects to search.
 * @param {string} id - The project ID to map.
 * @returns {string} The project name if known, or else the unchanged ID.
 */
const mapProjectName = (projects, id) => {
  const found = projects.find(p => p.id === id);
  if (!found) {
    if (!unknownProjects.includes(id) && id !== 'all') {
      unknownProjects.push(id);
    }

    return id;
  }

  return found.name;
};

/**
 * Get all resources for a given type, mapping project IDs if required.
 *
 * @param {object} parent - This resource type's parent type or scope.
 * @param {string} type - Resource type as property of scope.
 * @param {object[]} projects - Projects to search if mapProjectIds is set.
 * @param {boolean} [mapProjectIds] - If true, attempt to map project IDs to name.
 * @param {boolean} [report] - If true, report which resource is being read.
 * @returns {object[]} Array of read resources.
 */
const getAllResources = (parent, type, projects, mapProjectIds = true, report = true) => {
  if (report) {
    console.log(`Reading all ${type}s...`);
  }

  return pRetry(async () => {
    const it = parent[type]().setPerPage(100).setWithScopes().pages();
    const result = [];

    let page;
    while (!(page = await it.next()).done) {
      page.value.forEach((item) => {
        // Map project IDs to names
        if (mapProjectIds && item.scopes && item.scopes.projects) {
          item.scopes.projects = item.scopes.projects.map(p => mapProjectName(projects, p));
        }

        result.push(item);
      });
    }

    return result;
  }, { retries: 5 });
};

/**
 * Get all applications for a given project.
 *
 * @param {object} operator - Operator scope to use.
 * @param {object[]} projects - The projects to search.
 * @param {object} p - Project to use.
 * @returns {Promise} Promise that resolves to an array of applications.
 */
const getProjectApplications = (operator, projects, p) =>
  getAllResources(operator.project(p.id), 'application', projects, true, false);

/**
 * For each project, read all applications and append name scopes.
 *
 * @param {object} operator - Operator scope to use.
 * @param {object[]} projects - The projects to use.
 * @returns {Promise} Promise that resolves to all the applications.
 */
const getAllApplications = async (operator, projects) => {
  console.log('Reading all applications...');

  const res = await Promise.all(projects.map(p => getProjectApplications(operator, projects, p)));
  return res.reduce((result, item) => result.concat(item), []);
};

/**
 * For each role, read all permissions.
 *
 * @param {object} operator - Operator scope to use.
 * @param {object[]} roles - The roles to use.
 * @returns {Promise} Promise that resolves to an array of role permission sets
 */
const getAllRolePermissions = async (operator, roles) => {
  console.log('Reading all role permissions...');

  for (const role of roles) {
    role.permissions = await operator.role(role.id).permission().read();
  }
};

/**
 * Read all the required resources in an account.
 *
 * @param {object} operator - Operator scope to use.
 * @returns {Promise} Promise resolving to an bject containing the resources.
 */
const readAccount = async (operator) => {
  const projects = await getAllResources(operator, 'project', null, false);
  const applications = await getAllApplications(operator, projects);
  const products = await getAllResources(operator, 'product', projects);
  const actionTypes = await getAllResources(operator, 'actionType', projects)
    .then(res => res.filter(p => !DEFAULT_ACTION_TYPES.includes(p.name)));
  const places = await getAllResources(operator, 'place', projects);
  const roles = await getAllResources(operator, 'role', projects)
    .then(res => res.filter(p => !DEFAULT_ROLES.includes(p.name)));
  await getAllRolePermissions(operator, roles);

  return {
    projects,
    applications,
    products,
    actionTypes,
    places,
    roles,
    unknownProjects,
  };
};

module.exports = {
  readAccount,
  mapProjectName,
  getAllResources,
  getProjectApplications,
  getAllApplications,
  getAllRolePermissions,
};
