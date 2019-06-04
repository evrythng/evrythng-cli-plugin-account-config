/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const evrythng = require('evrythng');
const exportToFile = require('./exportToFile');

let cli;

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

module.exports = (api) => {
  cli = api;

  const command = {
    about: 'Manage account resource configuration.',
    firstArg: 'account-config',
    operations: {
      export: {
        execute: async ([, jsonFile]) => exportToFile(jsonFile, await getOperator()),
        pattern: 'export $jsonFile',
        helpPattern: 'export $jsonFile --api-key $OPERATOR_API_KEY',
      },
    },
  };

  api.registerCommand(command);
};
