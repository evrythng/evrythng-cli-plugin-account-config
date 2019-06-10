/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const evrythng = require('evrythng');
const { exportToFile } = require('./modules/export');
const { importFromFile } = require('./modules/import');
const { compareAccounts } = require('./modules/compare');

let cli;

/**
 * Create an Operator scope using the provided API key.
 *
 * @param {string} apiKey - Specific key, else the current is used.
 * @returns {Promise} Promise that resolves to the initialised Operator scope.
 */
const getOperator = async (apiKey) => {
  const config = cli.getConfig();

  // Get operator used
  const operators = config.get('operators');
  const using = config.get('using');

  // Apply their region
  const current = operators[using];
  const regions = config.get('regions');
  const apiUrl = regions[current.region];
  evrythng.setup({ apiUrl });

  return new evrythng.Operator(apiKey || current.apiKey).init();
};

module.exports = (api) => {
  cli = api;

  const command = {
    about: 'Manage account resource configuration.',
    firstArg: 'account-config',
    operations: {
      export: {
        execute: async ([, jsonFile, typeList]) =>
          exportToFile(jsonFile, typeList, await getOperator()),
        pattern: 'export $jsonFile $typeList',
      },
      import: {
        execute: async ([, jsonFile, updateArg]) =>
          importFromFile(jsonFile, updateArg, await getOperator()),
        pattern: 'import $jsonFile',
        helpPattern: 'import $jsonFile [update]',
      },
      compare: {
        execute: async () => {
          const { API_KEY: otherApiKey } = api.getSwitches();
          if (!otherApiKey) {
            throw new Error('Specify the \'other\' account using --api-key');
          }

          return compareAccounts(await getOperator(), await getOperator(otherApiKey));
        },
        pattern: 'compare',
        helpPattern: 'compare --api-key $OTHER_ACCOUNT_API_KEY',
      },
    },
  };

  api.registerCommand(command);
};
