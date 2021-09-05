# NotePlan Plugins Creating Pull Request

## Overview
When creating a Pull Request for your plugin, the following workflow will provide all the initial information for reviewer.

## Getting Started

### Create New Plugin
If you are creating a new plugin, use the NotePlan CLI command `noteplan-cli plugin:create`

### Create New Branch
Create a new branch (wether it be a new feature or bug fix) exists in a new branch, never work directly against the `main` branch.

For new features

```bash
git checkout -b feature/your-feature
```

For bug fixes

```bash
git checkout -b fix/small-label
```

### Example Workflow
When creating new code, the following is a common workflow used internally

1. Create a new branch, (e.g., `feature/name` or `fix/name`) which has ALL the code related to your feature or bug fix
2. When you are to test against main, I create a new branch from `main` typically called `preflight/main` which I will them perform git merge `feature/name`
	_Note: Make sure you are always testing against the current main branch (use `git pull upstream main` to get latest code)_
3. Make any merge conflicts adjustments (this should be very minimal as you will usually be working with your own plugins)
4. If issues are found in the `feature/name` branch, should return to your feature branch and make adjustments
	- After you have fixed the issue(s) you can return to the `preflight/main` branch and merge in your new code (`git merge feature/name`)
5. Rinse and repeat 2…4 until everything is in working order

## Creating Pull Request
Once you are satisfied with your code changes in new branch, you can create a pull request.  Make sure the description is thorough so that your PR can be reviewed as quickly as possible and reduce the amount of back and forth during review process.

_Note: If there is not enough information in the `description` to make testing PR, the reviewer will likely reject the PR until this is provided (thus doing it at start will make it that much easier)_

### Version Numbering Format
Make sure to create a new version number `x.x.x-pr.1` so that it is obvious when reviewing plugin list in `NotePlan Preferences > Plugins`

### Create Pull Request

#### Using Github (Preferred Method)
Use the interface on Github website to create your new PR, it is a pretty straight forward process.  This is the preferred method as you can provide as much description as necessary, providing the various styling etc.

#### Using NotePlan CLI (Alternate Method)
Alternately, you can use the NotePlan CLI to generate the Pull Request

```bash
noteplan-cli plugin:pr <pluginName> --title "Pull Request Title" --description "Pull Request Description"
```

## NotePlan Plugin Support
Should you need support for anything related to NotePlan Plugins, you can reach us at the following:

### Email
If you would prefer email, you can reach us at:

- [NotePlan Info](hello@noteplan.co)

### Discord
Perhaps the fastest method would be at our Discord channel, where you will have access to the widest amount of resources:

- [Discord Plugins Channel](https://discord.com/channels/763107030223290449/784376250771832843)

### Github Issues
This is a great resource to request assistance, either in the form of a bug report, or feature request for a current or future NotePlan Plugin

- [GitHub Issues](https://github.com/NotePlan/plugins/issues/new/choose)
