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


### `export $jsonFile`

Export resources listed above to `jsonFile`.


### `import $jsonFile`

Import resources listen above from `jsonFile`, if it is valid according to
`data/account-config.schema.json`.


### `compare $jsonFile --api-key $OTHER_API_KEY`

Compare resources in current account selected with `operators $name use` with
some other account selected with the `--api-key` switch. A file `diff.json` is
created containing all those found in the selected account but which do **not**
appear in the other account (by `name`).
