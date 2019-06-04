/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const { validate } = require('jsonschema');
const fs = require('fs');

let operator;
let projects;

const SCHEMA = require('../data/account-config.schema.json');

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
 * Update a log line with progress instead of issuing multiple lines.
 *
 * @param {string} label - Progress label for context.
 * @param {number} index - Current progress index.
 * @param {number} max - Total items to progress though.
 */
const printProgress = (label, index, max) => {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`${label}: ${index + 1}/${max}`);
};

/**
 * Map a project name to an ID. If it is not found, an error is thrown.
 *
 * @param {string} name - Project name to resolve.
 * @returns {string} The project ID, else null.
 */
const mapProjectNameToId = (name) => {
  const found = projects.find(p => p.name === name);
  if (!found) {
    throw new Error(`Project ${name} not found in file.`);
  }

  return found.id;
};

/**
 * Return a task function that creates a given resource.
 *
 * @param {object} parent - Parent resource or scope.
 * @param {object} payload - The payload to use.
 * @param {string} type - The resource type, property of Operator scope.
 * @returns {function} Function that returns the creation task promise.
 */
const buildCreateResourceTask = (parent, payload, type) => async () => parent[type]().create(payload);

/**
 * Import a list of resources, scoping to project if desired.
 *
 * @param {object} parent - Parent resource or scope.
 * @param {object[]} resources - List of resources to import.
 * @param {string} type - The resource type, property of Operator scope.
 * @param {boolean} [resolveScopes] - If true, attempt to resolve named project scopes.
 */
const importResources = async (parent, resources, type, resolveScopes = true) => {
  const tasks = resources.map((item) => {
    if (resolveScopes && item.scopes) {
      // Resolve project names to newly created project IDs
      item.scopes = {
        projects: item.scopes.projects.map(mapProjectNameToId),
        users: item.scopes.users || [],
      };
    }

    return buildCreateResourceTask(parent, item, type);
  });

  for (const task of tasks) {
    await task();
    printProgress(`Importing ${type}s`, tasks.indexOf(task), tasks.length);
  }

  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`Imported ${tasks.length} ${type}s.\n`);
};

const importApplications = async (applications) => {
  for (const app of applications) {
    const [projectName] = app.scopes.projects;
    const project = projects.find(p => p.name === projectName);

    await buildCreateResourceTask(operator.project(project.id), app, 'application')();
  }
};

/**
 * Import resources into the current operator's account.
 *
 * @param {string} jsonFile - Path to the JSON file to load.
 * @param {object} operatorScope - The Operator scope to do the loading.
 */
const importFromFile = async (jsonFile, operatorScope) => {
  operator = operatorScope;

  if (!jsonFile) {
    throw new Error('Please specify $jsonFile to an input file.');
  }

  const accountConfig = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  validateAccountConfig(accountConfig);
  console.log('File is valid');

  projects = accountConfig.projects;
  const {
    applications, products, actionTypes, places,
  } = accountConfig;

  await importResources(operator, projects, 'project', false);
  await importApplications(applications);
};

module.exports = importFromFile;
