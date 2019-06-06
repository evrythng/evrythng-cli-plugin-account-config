/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const _ = require('lodash');
const fs = require('fs');
const { readAccount } = require('./read');

/** Path to the diff file. */
const DIFF_PATH = `${__dirname}/../diff.json`;

/**
 * Find all items of a type in current account that don't appear in other account.
 *
 * @param {object} currentAccount - The current account Operator scope.
 * @param {object} otherAccount - The other account Operator scope.
 * @param {string} type - The type of resources to compare.
 * @returns {object[]} List of items that are not in other account.
 */
const diffType = (currentAccount, otherAccount, type) => currentAccount[type].filter((item) => {
  const otherItem = otherAccount[type].find(p => p.name === item.name);
  if (!otherItem) {
    return true;
  }

  if (type !== 'roles') {
    return !otherItem;
  }

  return !_.isEqual(otherItem.permissions, item.permissions);
});

/**
 * Read two accounts, and compare all resources by name.
 *
 * @param {object} currentScope - Currently selected Operator scope.
 * @param {object} otherScope - Other specified Operator scope.
 */
const compareAccounts = async (currentScope, otherScope) => {
  console.log('\nReading current account...');
  const currentAccount = await readAccount(currentScope);
  console.log('\nReading other account...');
  const otherAccount = await readAccount(otherScope);

  // Determine all resources that exist in curent account, but NOT in other account.
  // Intent is to update the other account to how this one (a test account?) is set up.
  const diff = {
    projects: diffType(currentAccount, otherAccount, 'projects'),
    applications: diffType(currentAccount, otherAccount, 'applications'),
    products: diffType(currentAccount, otherAccount, 'products'),
    actionTypes: diffType(currentAccount, otherAccount, 'actionTypes'),
    places: diffType(currentAccount, otherAccount, 'places'),
    roles: diffType(currentAccount, otherAccount, 'roles'),
  };

  console.log('\nOther account is missing:');
  Object.entries(diff).forEach(([key, value]) => console.log(`  ${value.length} ${key}`));

  // Write diff to file
  fs.writeFileSync(DIFF_PATH, JSON.stringify(diff, null, 2), 'utf8');
  console.log('\nWrote diff.json\n');
};

module.exports = {
  compareAccounts,
};