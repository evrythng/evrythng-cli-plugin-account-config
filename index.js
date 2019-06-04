/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const evrythng = require('evrythng');
const fs = require('fs');

let cli;
let operator;
let projects;
let unknownProjects = [];

/**
 * Create an Operator scope using the provided API key.
 *
 * @returns {Promise} Promise that resolves to the initialised Operator scope.
 */
const getOperator = async () => {
  const apiKey = cli.getSwitches().API_KEY;
  if (!apiKey) {
    throw new Error('Must specify --api-key as the account admin Operator.');
  }

  return new evrythng.Operator(apiKey).init();
};

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
 * @returns {object[]} Array of read resources.
 */
const getAllResources = async (parent, type, mapProjectIds = true) => {
  console.log(`Reading all of '${type}'...`);
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

  console.log(`Read ${result.length} of '${type}'`);
  return result;
};

/**
 * For each project, read all applications and append name scopes.
 *
 * @param {object[]} projects - The projects to use.
 * @returns {Promise} Promise that resolves to all the applications.
 */
const getAllApplications = async projects =>
  Promise.all(projects.map(p => getAllResources(operator.project(p.id), 'application')));

/**
 * Export all account resources of selected types to a JSON file.
 *
 * @param {string} jsonFile - Path to the output file.
 */
const exportToFile = async (jsonFile) => {
  if (!jsonFile) {
    throw new Error('Please supply $jsonFile to an output file.');
  }

  operator = await getOperator();
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
  console.log(`Wrote ${jsonFile}`);
  console.log(`\nThe following projects were referenced by resources, but not found in the account:\n${unknownProjects.join(', ')}`);
};

module.exports = (api) => {
  cli = api;

  const command = {
    about: 'Manage account resource configuration.',
    firstArg: 'account-config',
    operations: {
      export: {
        execute: async ([, jsonFile]) => exportToFile(jsonFile),
        pattern: 'export $jsonFile',
        helpPattern: 'export $jsonFile --api-key $OPERATOR_API_KEY',
      },
    },
  };

  api.registerCommand(command);
};
