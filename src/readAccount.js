/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

let operator;
let projects;
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
 * @param {string} id - The project ID to map.
 * @returns {string} The project name if known, or else the unchanged ID.
 */
const mapProjectName = (id) => {
  const found = projects.find(project => project.id === id);
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
 * @param {boolean} [mapProjectIds] - If true, attempt to map project IDs to name.
 * @param {boolean} [report] - If true, report which resource is being read.
 * @returns {object[]} Array of read resources.
 */
const getAllResources = async (parent, type, mapProjectIds = true, report = true) => {
  if (report) {
    console.log(`Reading all ${type}s...`);
  }

  const it = parent[type]().setPerPage(100).setWithScopes().pages();
  const result = [];

  let page;
  while (!(page = await it.next()).done) {
    page.value.forEach((item) => {
      // Map project IDs to names
      if (mapProjectIds && item.scopes && item.scopes.projects) {
        item.scopes.projects = item.scopes.projects.map(mapProjectName);
      }

      result.push(item);
    });
  }

  return result;
};

/**
 * Get all applications for a given project.
 *
 * @param {object} project - Project to use.
 * @returns {Promise} Promise that resolves to an array of applications.
 */
const getProjectApplications = project =>
  getAllResources(operator.project(project.id), 'application', true, false);

/**
 * For each project, read all applications and append name scopes.
 *
 * @param {object[]} projects - The projects to use.
 * @returns {Promise} Promise that resolves to all the applications.
 */
const getAllApplications = async projects => {
  console.log('Reading all applications...');

  const res = await Promise.all(projects.map(getProjectApplications));
  return res.reduce((result, item) => result.concat(item), []);
};

/**
 * For each role, read all permissions.
 * As a special case, each is annotated with a 'roleName' property to enable import.
 *
 * @param {object[]} roles - The roles to use.
 * @returns {Promise} Promise that resolves to an array of role permission sets
 */
const getAllRolePermissions = async (roles) => {
  console.log('Reading all role permissions...');

  for (const role of roles) {
    role.permissions = await operator.role(role.id).permission().read();
  }
};

/**
 * Read all the required resources in an account.
 *
 * @param {object} operatorScope - Operator scope to use.
 * @returns {Promise} Promise resolving to an bject containing the resources.
 */
const readAccount = async (operatorScope) => {
  operator = operatorScope;

  projects = await getAllResources(operator, 'project', false);
  const applications = await getAllApplications(projects);
  const products = await getAllResources(operator, 'product');
  const actionTypes = await getAllResources(operator, 'actionType')
    .then(res => res.filter(p => !DEFAULT_ACTION_TYPES.includes(p.name)));
  const places = await getAllResources(operator, 'place');
  const roles = await getAllResources(operator, 'role')
    .then(res => res.filter(p => !DEFAULT_ROLES.includes(p.name)));
  await getAllRolePermissions(roles);

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

module.exports = readAccount;
