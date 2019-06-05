/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const readAccount = require('./readAccount');

const findMissing = (currentAccount, otherAccount, type) => {
  return currentAccount[type].filter((item) => {
    return !otherAccount[type].find(p => p.name === item.name);
  });
}

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
  const missing = {
    projects: findMissing(currentAccount, otherAccount, 'projects'),
    applications: findMissing(currentAccount, otherAccount, 'applications'),
    products: findMissing(currentAccount, otherAccount, 'products'),
    actionTypes: findMissing(currentAccount, otherAccount, 'actionTypes'),
    places: findMissing(currentAccount, otherAccount, 'places'),
    roles: findMissing(currentAccount, otherAccount, 'roles'),
    rolePermissions: findMissing(currentAccount, otherAccount, 'rolePermissions'),
  };
  Object.entries(missing).forEach(([key, value]) => {
    console.log(`Missing ${value.length} ${key}`);
  });
};

module.exports = compareAccounts;
