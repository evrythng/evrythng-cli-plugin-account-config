/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const fs = require('fs');
const readAccount = require('./readAccount');

/**
 * Export all account resources of selected types to a JSON file.
 *
 * @param {string} jsonFile - Path to the output file.
 * @param {object} operatorScope - Operator scope for this account.
 */
const exportToFile = async (jsonFile, operatorScope) => {
  if (!jsonFile) {
    throw new Error('Please specify $jsonFile to an output file.');
  }

  const accountConfig = await readAccount(operatorScope);
  const {
    projects,
    applications,
    products,
    actionTypes,
    places,
    roles,
    rolePermissions,

    unknownProjects,
  } = accountConfig;
  fs.writeFileSync(jsonFile, JSON.stringify(accountConfig, null, 2), 'utf8');

  console.log(`\nExport summary:\n  ${projects.length} projects\n  ${applications.length} applications`);
  console.log(`  ${products.length} products\n  ${actionTypes.length} action types`);
  console.log(`  ${places.length} places\n  ${roles.length} roles\n  ${rolePermissions.length} role permissions`);

  if (unknownProjects.length) {
    console.log(`\nUnknown projects:\n${JSON.stringify(unknownProjects)}`);
  }
};

module.exports = exportToFile;
