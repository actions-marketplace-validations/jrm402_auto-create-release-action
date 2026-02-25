# CHANGELOG

All changes to this project are documented in this file.

## v1.0.10

### Changes

- Fix: bug in changelog file parsing logic.

## v1.0.9

### Changes

- Update the test coverage.
- Add the option to specify the `package-file` and `changelog-file`.

## v1.0.8

### Changes

- Update the default value for `changelog-header-regexp` to include parsing versions that have pre-release notation (e.g., `1.0.0-rc` or `0.2.3-debug.2`).

## v1.0.7

- Update documentation to use `v1` tag instead of `latest` tag.

## v1.0.6

### Changes

- Add ability to use triggering actions that are not a `push`. The context of the `package.json` and the `CHANGELOG.md` file are pulled from the default branch in that case.

## v1.0.5

### Changes

- Add additional error logging for situations where the `CHANGELOG.md` file's lines could not be parsed.

## v1.0.4

### Changes

- Add additional error logging for situations where the `package.json` or `CHANGELOG.md` file could not be found or are empty.

## v1.0.3

### Changes

- Fix a bug that properly handles failed states and sets the step as failed in the GitHub action.

## v1.0.2

### Changes

- Update README notes.

## v1.0.1

### Changes

- Update action name to unique name: `Auto-Create Release from Version`

## v1.0.0

### Changes

- Initial release

## v0.0.0

Repository Created
