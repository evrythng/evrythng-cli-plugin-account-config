const { validate } = require('jsonschema');
const pRetry = require('p-retry');

/** Valid types for importing */
const VALID_TYPES = [
  'projects',
  'applications',
  'actionTypes',
  'products',
  'places',
  'roles',
];

/** The account configuration file schema. */
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

  console.log('File is valid\n');
};

/**
 * Update the last log line, instead of creating a new one.
 *
 * @param {string} msg - The new line message.
 */
const updateLine = (msg) => {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(msg);
};

/**
 * Update a log line with progress instead of issuing multiple lines.
 *
 * @param {string} label - Progress label for context.
 * @param {number} index - Current progress index.
 * @param {number} max - Total items to progress though.
 */
const printProgress = (label, index, max) => updateLine(`${label}: ${index + 1}/${max}`);

/**
 * Retry some async function up to 5 times.
 *
 * @param {function} func - The function to try.
 * @returns {Promise}
 */
const retry = async func => pRetry(func, { retries: 5 });

/**
 * Get the types desired from the string parameter.
 *
 * @param {string} typeList - List of types, such as 'projects,applications,places'.
 * @param {boolean} mandatoryProjects - If true, `projects` must be included in typeList.
 * @returns {string[]} List of types.
 */
const parseTypeList = (typeList, mandatoryProjects = true) => {
  if (!typeList) {
    throw new Error('Please specify $typeList.');
  }

  const types = typeList.split(',');
  if (!types.every(p => VALID_TYPES.includes(p))) {
    throw new Error(`Invalid typeList. Choose from ${VALID_TYPES.join(', ')}`);
  }

  if (!types.includes('projects') && mandatoryProjects) {
    throw new Error('Invalid typeList. At least \'projects\' is required.');
  }

  // Projects always required
  types.splice(types.indexOf('projects'), 1);
  return types;
};

module.exports = {
  VALID_TYPES,
  updateLine,
  printProgress,
  retry,
  parseTypeList,
  validateAccountConfig,
};
