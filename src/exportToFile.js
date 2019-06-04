/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const fs = require('fs');

let operator;
let projects;
let unknownProjects = [];

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
    console.log(`Reading all of '${type}'...`);
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
 * For each project, read all applications and append name scopes.
 *
 * @param {object[]} projects - The projects to use.
 * @returns {Promise} Promise that resolves to all the applications.
 */
const getAllApplications = async projects => {
  console.log('Reading all of \'application\'...');
  const res = await Promise.all(projects.map(p => getAllResources(operator.project(p.id), 'application', true, false)));
  return res.reduce((result, item) => result.concat(item), []);
};

/**
 * Export all account resources of selected types to a JSON file.
 *
 * @param {string} jsonFile - Path to the output file.
 * @param {object} operatorScope - Operator scope for this account.
 */
const exportToFile = async (jsonFile, operatorScope) => {
  operator = operatorScope;

  if (!jsonFile) {
    throw new Error('Please specify $jsonFile to an output file.');
  }

  projects = await getAllResources(operator, 'project', false);
  const [applications, products, actionTypes, places] = await Promise.all([
    getAllApplications(projects),
    getAllResources(operator, 'product'),
    getAllResources(operator, 'actionType'),
    getAllResources(operator, 'place'),
  ]);

  const accountConfig = {
    projects,
    applications,
    products,
    actionTypes,
    places,
  };

  fs.writeFileSync(jsonFile, JSON.stringify(accountConfig, null, 2), 'utf8');
  
  console.log(`\nExport summary:\n  ${projects.length} projects\n  ${applications.length} applications`);
  console.log(`  ${products.length} products\n  ${actionTypes.length} action types\n  ${places.length} places\n`);

  if (unknownProjects.length) {
    console.log(`\nUnknown projects:\n${unknownProjects.join(', ')}`);
  }
};

module.exports = exportToFile;
