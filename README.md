# evrythng-cli-plugin-account-config

Plugin for [`evrythng-cli`](https://github.com/evrythng/evrythng-cli) that
exports, imports, and compares account resource sets including:

* Projects & applications
* Products
* Action Types
* Places
* Roles & role permissions

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

```
$ evrythng account-config export $jsonFile
```


### Import Resources

Import resources listed above from `jsonFile` into the currently selected
account, if it is valid according to `data/account-config.schema.json`.
Resources are always created, even if they may be considered to already exist.

```
$ evrythng account-config import $jsonFile
```


### Compare Accounts

Compare resources in current account selected with `operators $name use` with
some other account selected with the `--api-key` switch. A file `diff.json` is
created containing all those found in the selected account but which do **not**
appear in the other account (by `name`).

```
$ evrythng account-config compare --api-key $OTHER_ACCOUNT_API_KEY
```
