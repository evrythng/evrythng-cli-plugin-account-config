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

module.exports = {
  VALID_TYPES,
  updateLine,
  printProgress,
  retry,
};
