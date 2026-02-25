# Auto-Create Release from Verion Action

This Action will automatically create a release when a commit is pushed. It is expected that a `CHANGELOG.md` will exist (see [inputs configuration](#inputs) and [example changelog](#example-changelogmd)).

## Usage

### Getting Started

To get started, create a workflow `.yml` file in your `.github/workflows` directory. There is an [example workflow](#example-workflow) below.

> [!NOTE]
> This action requires read/write permission for the `GITHUB_TOKEN`. Please review [these instructions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#permissions-for-the-github_token) to set the permissions appropriately for your repository.

### Inputs

The following inputs are available. All inputs are optional.

- `title`: Title of the release (The slug `$version` is replaced by the version detected in `package.json`). Default `v$version`
- `tag`: Name of the release tag (The slug `$version` is replaced by the version detected in `package.json`). Default `v$version`
- `draft`: Is this a draft release or not. Default `false`
- `package-file`: The path to the `package.json` file. Default `package.json`
- `changelog-file`: The path to the CHANGELOG file (including the file name). Default `CHANGELOG.md`
- `changelog-header-regexp`: The regular expression string a CHANGELOG line must match to be considered a version header. This MUST match a version group in the string. This group will be checked against the version found in package.json. Default `^## v(\d+\.\d+\.\d+(\-.+)*)`

### Outputs

- `success`: Whether or not a release was created.
- `id`: ID of the release.
- `version`: The version found in the `package.json` file; Used in the [Inputs](#inputs) section as `$version`.
- `releaseUrl`: The URL users can navigate to in order to view the release.

Outputs can be used in subsequent steps by referencing the step output as `steps.step-id.outputs.output-name`

### Example Workflow

On every `push` event, create a release.

```yml
# Workflow to auto-create GitHub release on push

name: Auto-Create Release

on:
  push:
    branches: [ main ]

jobs:
  release:
    runs-on: ubuntu-latest
    name: Process Release

    steps:
      - uses: actions/checkout@v2
      - uses: jrm402/auto-create-release-action@v1
        with:
          title: "v$version" # Optional
          tag: "v$version" # Optional
          draft: false # Optional
          package-file: "package.json" # Optional
          changelog-file: "CHANGELOG.md" # Optional
          changelog-header-regexp: "^## v(\d+\.\d+\.\d+)" # Optional
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Example CHANGELOG.md

Given the `CHANGELOG.md` below,

```md
# CHANGELOG

All changes to this project are documented in this file.

## v1.0.5

### Changes

- Fix a bug #38
- Added a new feature

## v1.0.4

...
```

The description for release `v1.0.5` would be:

```md
### Changes

- Fix a bug #38
- Added a new feature
```

## Inspiration

This Action was inspired by the GitHub Action: [GitHub Action // Auto-Release on Commit](https://github.com/CupOfTea696/gh-action-auto-release)

## License

This project is licensed under the [MIT License](https://github.com/Alive-For-Him/Auto-Release-Action/blob/main/LICENSE).
