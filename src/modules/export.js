/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const fs = require('fs');
const { readAccount } = require('./read');
const { parseTypeList } = require('../util');

/**
 * Export all account resources of selected types to a JSON file.
 *
 * @param {string} jsonFile - Path to the output file.
 * @param {string} typeList - List of desired types, such as 'projects,roles,places'.
 * @param {object} operatorScope - Operator scope for this account.
 */
const exportToFile = async (jsonFile, typeList, operatorScope) => {
  if (!jsonFile) {
    throw new Error('Please specify $jsonFile to an output file.');
  }

  console.log();

  const types = parseTypeList(typeList);
  const accountConfig = await readAccount(operatorScope, types);
  const {
    projects,
    applications,
    products,
    actionTypes,
    places,
    roles,

    unknownProjects,
  } = accountConfig;

  if (unknownProjects.length) {
    console.log(`\nUnknown projects:\n${JSON.stringify(unknownProjects)}`);
  }

  delete accountConfig.unknownProjects;
  fs.writeFileSync(jsonFile, JSON.stringify(accountConfig, null, 2), 'utf8');
  console.log(`\nWrote ${jsonFile}`);
};

module.exports = {
  exportToFile,
  parseTypeList,
};
