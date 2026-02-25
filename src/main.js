const core = require("@actions/core");
const { context, getOctokit } = require("@actions/github");

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (token == null) {
      throw new Error("The GITHUB_TOKEN environment variable was not set");
    }

    const rawTitle = core.getInput("title");
    const rawTag = core.getInput("tag");
    const rawDraft = core.getInput("draft");
    const rawPackageFile = core.getInput("package-file");
    const rawChangelog = core.getInput("changelog-file");
    const rawChangelogHeaderRegexp = core.getInput("changelog-header-regexp");

    const title = !rawTitle ? "v$version" : rawTitle;
    const tag = !rawTag ? "v$version" : rawTag;
    const draft =
      (rawDraft == null ? "false" : rawDraft).toLowerCase() === "true";
    const packageFile = rawPackageFile || "package.json";
    const changelog = rawChangelog || "CHANGELOG.md";
    const changelogHeaderRegexp =
      rawChangelogHeaderRegexp || "^## v(\\d+\\.\\d+\\.\\d+(\\-.+)*)";

    // get commit information
    let commitId = null;
    const commits = context.payload.commits;
    if (commits == null || commits.length === 0) {
      core.info("No commit context was found. Using default branch.");
    } else {
      const commit = commits[commits.length - 1];
      commitId = commit.id;
    }

    const pkgInfo = await getCommitInfo(token, packageFile, commitId);
    const clInfo = await getCommitInfo(token, changelog, commitId);

    // check package.json file
    if (pkgInfo == null) {
      return setFailed(`${packageFile} file could not be found.`, true);
    } else if (pkgInfo.length === 0) {
      return setFailed(`${packageFile} file is blank.`, true);
    }

    // check changelog file
    if (clInfo == null) {
      return setFailed(`${changelog} file could not be found.`, true);
    } else if (clInfo.length === 0) {
      return setFailed(`${changelog} file is blank.`, true);
    }

    // load version
    const _version = /"version":\s*"(.+)"/.exec(pkgInfo);
    if (_version == null || !_version[1]) {
      return setFailed(`Version was not found in ${packageFile}.`, true);
    }
    const version = _version[1];

    // load version-specific changelog
    const body = getChangelogVersion(clInfo, changelogHeaderRegexp, version);

    // create the release
    const release = await createRelease(token, {
      title: value(title, version),
      tag: value(tag, version),
      body,
      draft,
    });

    if (release === undefined) return;

    setSuccess({
      id: release.data.id,
      version: version,
      releaseUrl: release.data.html_url,
    });
  } catch (e) {
    console.error(e);
    setFailed(e.message ?? "An error has occurred.", true);
  }
}

/**
 * Get a file's contents from a commit
 */
async function getCommitInfo(token, path, ref) {
  const gh = getOctokit(token);
  let response;

  try {
    response = await gh.rest.repos.getContent({
      ...context.repo,
      path,
      ...(ref != null && { ref }),
    });
  } catch (e) {
    return "";
  }

  const { data } = response;

  if (Array.isArray(data)) {
    throw new Error(
      `The path ${path} is a folder. Please provide a file path.`,
    );
  }

  if (data.type === "symlink" && !data.content) {
    return await getCommitInfo(data.target, ref);
  }

  if (data.type === "submodule") {
    throw new Error(`The file cannot be inside of a submodule`);
  }

  if (!data.content) {
    return "";
    // throw new Error( `Something went wrong when trying to get the file at ${path}`);
  }

  return Buffer.from(data.content, "base64").toString("binary");
}

/**
 * Replace '$version' inside the `val` string
 */
const value = (val, version) => {
  return val.replace(/\$version/, version);
};

/**
 * Create a release
 */
const createRelease = async (token, { title, tag, draft, body }) => {
  const gh = getOctokit(token);

  try {
    // check for an existing tag
    await gh.rest.repos.getReleaseByTag({
      ...context.repo,
      tag,
    });

    setFailed(`Tag ${tag} already exists.`, true);
    return;
  } catch (e) {}

  try {
    // create the release
    const response = await gh.rest.repos.createRelease({
      ...context.repo,
      name: title,
      tag_name: tag,
      body: String(body),
      draft,
    });

    return response;
  } catch (e) {
    setFailed(e.message ?? "An error has occurred.", true);
  }
};

/**
 * Extract the version changes from the changelog
 */
const getChangelogVersion = (cl, clHeaderRegExp, version) => {
  const lines = cl.split(/\r?\n/);
  if (lines == null || lines.length === 0) {
    core.info("No lines were found in the CHANGELOG file");
    return "";
  }

  let changes = "";
  let headerMatch = false;

  const headerRegExp = new RegExp(clHeaderRegExp, "i");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const exec = headerRegExp.exec(line);

    // this is the beginning of the version match
    if (exec != null && exec.length >= 2) {
      if (headerMatch) break; // we are done; 2nd header match
      if (exec[1] === version) headerMatch = true; // begin matching
      continue;
    }

    if (headerMatch) changes += line + "\r\n";
  }

  return changes;
};

const setSuccess = ({ id, version, releaseUrl }) => {
  core.info(`id: ${id}`);
  core.info(`version: ${version}`);
  core.info(`releaseUrl: ${releaseUrl}`);

  core.setOutput("id", id);
  core.setOutput("version", version);
  core.setOutput("releaseUrl", releaseUrl);
  core.setOutput("success", true);
};

const setFailed = (msg, isError = false) => {
  core.setOutput("success", false);

  if (!isError) {
    core.info(msg);
  } else {
    core.setFailed(msg);
  }
};

module.exports = {
  run,
};
