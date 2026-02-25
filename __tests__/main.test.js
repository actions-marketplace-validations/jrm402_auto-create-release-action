/**
 * Unit tests for the action's main functionality, src/main.js
 */

const core = require("@actions/core");
const github = require("@actions/github");
const main = require("../src/main");

jest.mock("@actions/core");
jest.mock("@actions/github");

const mockGetContent = jest.fn();
const mockGetReleaseByTag = jest.fn();
const mockCreateRelease = jest.fn();

const PKG_CONTENT = Buffer.from(JSON.stringify({ version: "1.2.3" })).toString(
  "base64",
);

const CL_CONTENT = Buffer.from(
  "# CHANGELOG\n\n## v1.2.3\n\n### Changes\n\n- Fixed a bug\n- Added feature\n\n## v1.2.2\n\n- Old stuff\n",
).toString("base64");

// Provide input defaults that match what action.yml would supply at runtime
const INPUT_DEFAULTS = {
  title: "v$version",
  tag: "v$version",
  draft: "false",
  "package-file": "package.json",
  "changelog-file": "CHANGELOG.md",
  "changelog-header-regexp": "^## v(\\d+\\.\\d+\\.\\d+(\\-.+)*)",
};

function setupMocks({
  token = "fake-token",
  inputs = {},
  commits = [{ id: "abc123" }],
  pkgResponse = { data: { type: "file", content: PKG_CONTENT } },
  clResponse = { data: { type: "file", content: CL_CONTENT } },
  tagExists = false,
  releaseResponse = {
    data: { id: 42, html_url: "https://github.com/test/release/42" },
  },
} = {}) {
  process.env.GITHUB_TOKEN = token;

  core.getInput.mockImplementation((name) => {
    return inputs[name] ?? INPUT_DEFAULTS[name] ?? "";
  });

  github.context.repo = { owner: "test-owner", repo: "test-repo" };
  github.context.payload = { commits };

  mockGetContent.mockReset();
  mockGetReleaseByTag.mockReset();
  mockCreateRelease.mockReset();

  if (pkgResponse instanceof Error) {
    mockGetContent.mockRejectedValueOnce(pkgResponse);
  } else {
    mockGetContent.mockResolvedValueOnce(pkgResponse);
  }
  if (clResponse instanceof Error) {
    mockGetContent.mockRejectedValueOnce(clResponse);
  } else {
    mockGetContent.mockResolvedValueOnce(clResponse);
  }

  if (tagExists) {
    mockGetReleaseByTag.mockResolvedValue({ data: {} });
  } else {
    mockGetReleaseByTag.mockRejectedValue(new Error("Not found"));
  }

  mockCreateRelease.mockResolvedValue(releaseResponse);

  github.getOctokit.mockReturnValue({
    rest: {
      repos: {
        getContent: mockGetContent,
        getReleaseByTag: mockGetReleaseByTag,
        createRelease: mockCreateRelease,
      },
    },
  });
}

describe("run", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("fails when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith(
      "The GITHUB_TOKEN environment variable was not set",
    );
  });

  it("uses default branch when no commits in payload", async () => {
    setupMocks({ commits: null });
    await main.run();
    expect(core.info).toHaveBeenCalledWith(
      "No commit context was found. Using default branch.",
    );
    // getContent should be called without ref param
    expect(mockGetContent).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      path: "package.json",
    });
  });

  it("passes commit ref to getContent when commits exist", async () => {
    setupMocks({ commits: [{ id: "abc123" }] });
    await main.run();
    expect(mockGetContent).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      path: "package.json",
      ref: "abc123",
    });
  });

  it("fails when package file is empty", async () => {
    setupMocks({
      pkgResponse: new Error("not found"),
    });
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith("package.json file is blank.");
  });

  it("fails when changelog file is empty", async () => {
    setupMocks({
      clResponse: new Error("not found"),
    });
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith("CHANGELOG.md file is blank.");
  });

  it("fails when no version found in package file", async () => {
    const noVersionPkg = Buffer.from(JSON.stringify({ name: "test" })).toString(
      "base64",
    );
    setupMocks({
      pkgResponse: { data: { type: "file", content: noVersionPkg } },
    });
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith(
      "Version was not found in package.json.",
    );
  });

  it("fails when tag already exists", async () => {
    setupMocks({ tagExists: true });
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith("Tag v1.2.3 already exists.");
  });

  it("creates a release successfully (happy path)", async () => {
    setupMocks();
    await main.run();

    expect(mockCreateRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "v1.2.3",
        tag_name: "v1.2.3",
        draft: false,
      }),
    );
    expect(core.setOutput).toHaveBeenCalledWith("id", 42);
    expect(core.setOutput).toHaveBeenCalledWith("version", "1.2.3");
    expect(core.setOutput).toHaveBeenCalledWith(
      "releaseUrl",
      "https://github.com/test/release/42",
    );
    expect(core.setOutput).toHaveBeenCalledWith("success", true);
  });

  it("creates a draft release when draft input is true", async () => {
    setupMocks({ inputs: { draft: "true" } });
    await main.run();

    expect(mockCreateRelease).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true }),
    );
  });

  it("uses custom package-file input", async () => {
    setupMocks({
      inputs: { "package-file": "apps/server/package.json" },
    });
    await main.run();

    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({ path: "apps/server/package.json" }),
    );
  });

  it("fails when createRelease API throws", async () => {
    setupMocks();
    mockCreateRelease.mockRejectedValueOnce(new Error("API error"));
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith("API error");
  });

  it("handles getContent returning a folder (array)", async () => {
    setupMocks({
      pkgResponse: { data: [{ name: "file1" }, { name: "file2" }] },
    });
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("is a folder"),
    );
  });

  it("handles getContent returning a submodule", async () => {
    setupMocks({
      pkgResponse: { data: { type: "submodule" } },
    });
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("submodule"),
    );
  });

  it("handles getContent returning no content", async () => {
    setupMocks({
      pkgResponse: { data: { type: "file" } },
    });
    await main.run();
    expect(core.setFailed).toHaveBeenCalledWith("package.json file is blank.");
  });

  it("follows symlinks when getContent returns a symlink", async () => {
    setupMocks();
    mockGetContent.mockReset();
    mockGetContent
      .mockResolvedValueOnce({
        data: { type: "symlink", target: "real-package.json" },
      })
      .mockResolvedValueOnce({
        data: { type: "file", content: PKG_CONTENT },
      })
      .mockResolvedValueOnce({
        data: { type: "file", content: CL_CONTENT },
      });

    await main.run();
    expect(mockGetContent).toHaveBeenCalledTimes(3);
  });

  it("extracts changelog content for the matching version only", async () => {
    setupMocks();
    await main.run();

    const createCall = mockCreateRelease.mock.calls[0][0];
    expect(createCall.body).toContain("Fixed a bug");
    expect(createCall.body).toContain("Added feature");
    expect(createCall.body).not.toContain("Old stuff");
  });

  it("handles release returning undefined (tag exists path)", async () => {
    setupMocks({ tagExists: true });
    await main.run();
    expect(mockCreateRelease).not.toHaveBeenCalled();
  });

  it("replaces $version in title and tag", async () => {
    setupMocks({
      inputs: { title: "Release $version", tag: "release-$version" },
    });
    await main.run();

    expect(mockCreateRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Release 1.2.3",
        tag_name: "release-1.2.3",
      }),
    );
  });

  it("sets success to false on setFailed", async () => {
    setupMocks({ tagExists: true });
    await main.run();
    expect(core.setOutput).toHaveBeenCalledWith("success", false);
  });
});
