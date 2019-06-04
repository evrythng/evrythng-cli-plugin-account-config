/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const evrythng = require('evrythng');
const exportToFile = require('./exportToFile');
const importFromFile = require('./importFromFile');

let cli;

/**
 * Create an Operator scope using the provided API key.
 *
 * @returns {Promise} Promise that resolves to the initialised Operator scope.
 */
const getOperator = async () => {
  const config = cli.getConfig();
  const operators = config.get('operators');
  const using = config.get('using');
  return new evrythng.Operator(operators[using].apiKey).init();
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
      },
      import: {
        execute: async ([, jsonFile]) => importFromFile(jsonFile, await getOperator()),
        pattern: 'import $jsonFile',
      },
    },
  };

  api.registerCommand(command);
};
