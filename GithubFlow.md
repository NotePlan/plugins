# Contributing to Noteplan/plugins

The process of contributing to Noteplan/plugins is the same as contributing to any Github  open source projects. But it can be a little daunting if you have never done it before. Here's a brief walk through.

## Creating a Fork

Just head over to the NotePlan Plugins [GitHub page](https://github.com/NotePlan/plugins) and click the "Fork" button. 
<img width="500" alt="Screen Cap 2023-04-02 at 09 29 36@2x" src="https://user-images.githubusercontent.com/8949588/229366802-404fcaa2-523d-4c27-9803-9e0ba913d01d.png">

You can use all the default settings, which will fork it into your Github account under the name "plugins":
<img width="500" alt="Screen Cap 2023-04-02 at 09 54 12@2x" src="https://user-images.githubusercontent.com/8949588/229367303-bf504ca1-15fe-4b9f-b8c9-e8b3afcc93fd.png">

This will create a fork (copy) of the noteplan/plugins repository in your **personal github account** (e.g. YOUR_GITHUB_USERNAME/plugins). Now we need to get the link to that repository, so Click the green `Code` button and click the overlapping squares icon to copy the link to this repository on your github account. 

<img width="494" alt="Screen Cap 2023-04-02 at 10 10 00@2x" src="https://user-images.githubusercontent.com/8949588/229368157-a02bc0e9-8f82-4c84-8a1e-1556bd2165d8.png">

## Decide where you want to work on the code

You will be working on your code in a directory outside of the NotePlan file sandbox, so you can put the plugin development code anywhere you want on your computer. You will then use the command line interface tool (`noteplan-cli`) in the plugin repository to automatically build and copy the plugin code from your development folder to your NotePlan Plugins folder so you can test/use your plugin. So now, find or create a directory where you want to start development (anywhere on your computer).

## Cloning the Repo to your Desktop

Once you have your own fork (on Github.com) and a directory where you want to develop, you'll need to create a **clone** of that code on your local computer so you can work on it. To do that, you can use any git client app (e.g. the [free Github Desktop app](https://desktop.github.com/) to clone your repo, or if you prefer, skip the app and just head straight to the command line in your terminal:

```shell
# Change directory to where you want to install the plugins project
cd DIR_PATH

# Clone the fork we just created to your local machine
git clone https://github.com/YOUR_GITHUB_USERNAME/plugins.git
```
> **Note**
> The URL above ^^^ is the one you copied in the previous step.

This will create a clone (aka "working copy") of the repository on your local computer

## Keeping Your Fork Up to Date

Over time, you'll want to make sure you keep your fork up to date by tracking the original "upstream" repo that you forked. To do this, you'll need to add a remote:

```shell
# Change directory so you're in the local working copy of the plugins
cd plugins

# Add 'upstream' repo to list of remotes
git remote add upstream https://github.com/NotePlan/plugins.git

# Verify the new remote named 'upstream'
git remote -v
```

This should show you two sets of "remotes": 
- push/pull to your repository on github
- push/pull to the main NotePlan/plugins (upstream) repository

### Keeping your fork up-to-date

To keep your fork/working copy updated with the latest upstream changes (changes in the main NotePlan repository), you'll need to first fetch the upstream repo's branches and latest commits to bring them into your repository:

```shell
# Fetch from upstream remote
git fetch upstream
```

Now, checkout your own main (master) branch and merge the upstream repo's main branch:

> ***NOTE:*** NotePlan's master branch is "main". So if you see instructions on the Internet for git-related things that tell you to do something to "master", just replace that with "main"

```shell
# Checkout your main branch and merge the upstream changes into your local copy
git checkout main
# Note: You will already be on the main branch by default unless you have created/switched to a branch
git merge upstream/main
```

If there are no conflicting commits on your local master/main branch, git will simply perform a "fast-forward" (it will bring all the latest NotePlan/plugins commits into your working copy). However, if you have been making changes on your master/main (in the vast majority of cases you probably shouldn't be - [see the next section](#doing-your-work), you may have to deal with conflicts. When doing so, be careful to respect the changes made upstream.

Now, your local master/main branch is up-to-date with everything modified upstream.

## Doing Your Work

### Create a Branch
Whenever you begin work on a new feature or bugfix, it's important that you create a new branch. Not only is it proper git workflow, but it also keeps your changes organized and separated from the master branch so that you can easily submit and manage multiple pull requests for every task you complete.

To create a new branch and start working on it:

```shell
# Checkout the master/main branch - you always want your new branch to always be based on main
git checkout main

# Create a new branch named newfeature (give your branch its own simple informative name)
git branch newfeature

# Switch to your new branch
git checkout newfeature
```

Now, go to town hacking away and making whatever changes you want to. You should add files and make local commits to your repository as you work. [Read this](https://support.atlassian.com/bitbucket-cloud/docs/add-edit-and-commit-to-source-files/) for more information. A good rule of thumb is to do a commit each time you add a new file or get some meaningful piece of code working. Committing along the way gives you a "save point" that you could roll back to if things go wrong along the way. This will cause you to have lots of commits, but we will clean that up later before issuing a pull request.

When you want to submit your changes to be potentially included in the main/public NotePlan plugins repository, you will want to create a [Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests).

## Submitting a Pull Request to NotePlan

### Cleaning Up Your Work

Prior to submitting your pull request, you should do a few things to clean up your branch and make it as simple as possible for the NotePlan repo's maintainers to test, accept, and merge your work.

The first step is to make sure there are no changes on the main NotePlan repository that you haven't merged locally.  

```shell
# Fetch upstream master/main and merge with your repo's master/main branch
git fetch upstream
git checkout main
git merge upstream/main

# If you see any new commits on main mentioned, you will need to rebase your development branch
git checkout newfeature
git rebase main
```

Now, it may be desirable to squash some of your smaller commits down into a small number of larger more cohesive commits. You can do this with an interactive rebase:

```shell
# Rebase all commits on your development branch
git checkout newfeature
git rebase -i main
```

This will open up a text editor where you can specify which commits to squash. [Read this](https://medium.com/@slamflipstrom/a-beginners-guide-to-squashing-commits-with-git-rebase-8185cf6e62ec) for more information.

### Pushing your changes to Github

Now that you have changes committed locally on your computer, you need to push them up to your Github forked repository.

```shell
# push local changes to your github repository as a feature branch
git push origin newfeature
```

### Submitting

Once you've committed and pushed all of your changes to GitHub, go to the page for your fork on GitHub.com, select your development branch, and click the pull request button. Fill out the description and submit the request for consideration.

### Making Changes

If you need to make any adjustments to code in your pull request (either thoughts you had or requests from the NotePlan repo maintainer), you can just just `git push` new changes/updates to the branch you submitted for a pull request. Github will automatically update the pull request with your new code.

### Clean-up

After your PR is accepted and you're done with the development branch, you're free to delete it.

```shell
git branch -d newfeature
```

**Copyright**

Credits: Instructions based on [this gist](https://gist.githubusercontent.com/Chaser324/ce0505fbed06b947d962/raw/23b18d33a8e1a512c53155aabdf97042d8c63768/GitHub-Forking.md)

Copyright 2017, Chase Pettit

MIT License, http://www.opensource.org/licenses/mit-license.php
 
**Additional Reading**
* [Atlassian - Merging vs. Rebasing](https://www.atlassian.com/git/tutorials/merging-vs-rebasing)

**Sources**
* [GitHub - Fork a Repo](https://help.github.com/articles/fork-a-repo)
* [GitHub - Syncing a Fork](https://help.github.com/articles/syncing-a-fork)
* [GitHub - Checking Out a Pull Request](https://help.github.com/articles/checking-out-pull-requests-locally)
