# evrythng-cli-plugin-account-config

Plugin for [`evrythng-cli`](https://github.com/evrythng/evrythng-cli) that
exports, imports, and compares account resource sets including:

* Roles & role permissions
* Projects & applications
* Action Types
* Places
* Products
* Thngs

**When comparing accounts, all resources are compared by `name` only.**


## Install

Install alongside `evrythng-cli`. Usually this is globally:

```
npm i -g evrythng-cli-plugin-account-config
```


## Usage

Once installed, the `account-config` command set is added, including three new
operations:


### Export Resources

Export resources listed above to `jsonFile` (such as `./export.json`).
`typeList` must be a comma-separated list of desired resource types from
`projects`, `applications`, `actionTypes`, `products`, `places`, or `roles`.

```
$ evrythng account-config export $jsonFile $typeList
```


### Import Resources

Import resources listed above from `jsonFile` into the currently selected
account, if it is valid according to `data/account-config.schema.json`.

If `update` is specified, resources will be searched for by `name` and
updated, else they will always be created new.

```
$ evrythng account-config import $jsonFile [update]
```


### Compare Accounts

Compare resources in current account selected with `operators $name use` with
some other account selected with the `--api-key` switch. A file `diff.json` is
created containing all those found in the selected account but which do **not**
appear in the other account (by `name`).

`typeList` must be specified, in the same way as for 'Export Resources'.

```
$ evrythng account-config compare $typeList --api-key $OTHER_ACCOUNT_API_KEY
```
