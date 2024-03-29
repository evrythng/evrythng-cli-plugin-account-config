/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const { VALID_TYPES, printProgress, updateLine, retry } = require('../util');

let unknownProjects = [];
let unknownProducts = [];
let products = [];

/** The default roles in every account */
const DEFAULT_ROLES = [
  'admin',
  'none',
  'Base Application User',
];
/** The default action types in every account */
const DEFAULT_ACTION_TYPES = [
  'checkins',
  'commissions',
  'decommissions',
  'encodings',
  'implicitScans',
  'invalidScans',
  'scans',
  'shares',
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
 * Map a product ID to a known product name, or else leave as is.
 *
 * @param {string} id - The product ID to map.
 * @param {object[]} products - Products to search.
 * @returns {string} The product name if known, or else the unchanged ID.
 */
const getProductName = (products, id) => {
  const found = products.find(p => p.id === id);
  if (!found) {
    if (!unknownProducts.includes(id) && id !== 'all') {
      unknownProducts.push(id);
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
const getAllResources = (parent, type, projects, mapProjectIds = true, report = true) =>
  retry(async () => {
    const it = parent[type]().setPerPage(100).setWithScopes().pages();
    const result = [];

    let page;
    while (!(page = await it.next()).done) {
      page.value.forEach((item) => {
        // Map project IDs to names
        if (mapProjectIds && item.scopes && item.scopes.projects) {
          item.scopes.projects = item.scopes.projects.map(p => mapProjectName(projects, p));
        }

        // Thng product
        if (type === 'thng' && item.product) {
          item.product = getProductName(products, item.product);
        }

        result.push(item);
        printProgress(`Reading ${type}s`, result.length, '-');
      });
    }

    if (report) {
      updateLine(`Read ${result.length} ${type}s\n`);
    }

    return result;
  });

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
  const res = await Promise.all(projects.map(p => getProjectApplications(operator, projects, p)));
  const total = res.reduce((result, item) => result.concat(item), []);

  updateLine(`Read ${total.length} applications\n`);
  return total;
};

/**
 * For each role, read all permissions.
 *
 * @param {object} operator - Operator scope to use.
 * @param {object[]} roles - The roles to use.
 * @returns {Promise} Promise that resolves to an array of role permission sets
 */
const getAllRolePermissions = async (operator, roles) => {
  const tasks = roles.map(role => async () => {
    printProgress(`Reading role permissions`, roles.indexOf(role), roles.length);
    role.permissions = await retry(async () => operator.role(role.id).permission().read());
  });

  while (tasks.length) {
    const next = tasks.splice(0, tasks.length >= 5 ? 5 : tasks.length);
    await Promise.all(next.map(p => p()));
  }

  updateLine(`Read ${roles.length} role permissions\n`);
};

/**
 * Read all the required resources in an account.
 *
 * @param {object} operator - Operator scope to use.
 * @param {string[]} types - List of desired types to read.
 * @returns {Promise} Promise resolving to an bject containing the resources.
 */
const readAccount = async (operator, types) => {
  const result = {};

  const projects = await getAllResources(operator, 'project', null, false);
  const map = {
    // Already loaded first
    projects: async () => {},

    products: async () => {
      products = await getAllResources(operator, 'product', projects);
      return products;
    },
    applications: async () => getAllApplications(operator, projects),
    actionTypes: async () => getAllResources(operator, 'actionType', projects)
      .then(res => res.filter(p => !DEFAULT_ACTION_TYPES.includes(p.name))),
    places: async () => getAllResources(operator, 'place', projects),
    roles: async () => {
      const res = await getAllResources(operator, 'role', projects)
        .then(res => res.filter(p => !DEFAULT_ROLES.includes(p.name)));
      await getAllRolePermissions(operator, res);
      return res;
    },
    thngs: async () => getAllResources(operator, 'thng', projects),
  };

  for (const t of VALID_TYPES) {
    result[t] = [];

    if (types.includes(t)) {
      result[t] = await map[t]();
    }
  }

  Object.assign(result, { projects, products, unknownProjects, unknownProducts });
  return result;
};

module.exports = {
  readAccount,
  mapProjectName,
  getAllResources,
  getProjectApplications,
  getAllApplications,
  getAllRolePermissions,
  getProductName,
};
