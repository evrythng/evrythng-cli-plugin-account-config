/**
 * (c) Copyright Reserved EVRYTHNG Limited 2019.
 * All rights reserved. Use of this material is subject to license.
 */

const fs = require('fs');
const readAccount = require('./readAccount');

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
const findMissing = (currentAccount, otherAccount, type) => currentAccount[type].filter((item) => {
  if (type !== 'rolePermissions') {
    return !otherAccount[type].find(p => p.name === item.name);
  }

  // permissions are arrays (but still associated with a named role...)
  // For each permission in current
  return currentAccount.rolePermissions.filter((item) => {
  //   get the name of the role
    const { roleName } = item.find(p => p.roleName);
  //   if the role exists in other, compare the permissions in other
    const otherRole = otherAccount.roles.find(p => p.name === roleName);
    if (otherRole) {
      const otherPermissions = otherAccount.rolePermissions.find(p => 
        p.find(q => q.roleName && q.roleName === roleName));

      console.log(item);
      console.log(otherPermissions);
      process.exit()

      return !otherPermissions.every(p => item.includes(p));
    } else {
  //   if not, wthh?
    }
  });
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
    projects: findMissing(currentAccount, otherAccount, 'projects'),
    applications: findMissing(currentAccount, otherAccount, 'applications'),
    products: findMissing(currentAccount, otherAccount, 'products'),
    actionTypes: findMissing(currentAccount, otherAccount, 'actionTypes'),
    places: findMissing(currentAccount, otherAccount, 'places'),
    roles: findMissing(currentAccount, otherAccount, 'roles'),
    rolePermissions: findMissing(currentAccount, otherAccount, 'rolePermissions'),
  };

  console.log('\nOther account is missing:');
  Object.entries(diff).forEach(([key, value]) => console.log(`  ${value.length} ${key}`));

  // Write diff to file
  fs.writeFileSync(DIFF_PATH, JSON.stringify(diff, null, 2), 'utf8');
  console.log('\nWrote diff.json\n');
};

module.exports = compareAccounts;
