#!/usr/bin/env node
/**
 * Creates or updates the repository ruleset that protects main/develop:
 * - Required status check: CI job "test"
 * - One approving review on pull requests
 * - Bypass review requirement for the repository owner (pull_request bypass only; CI still required)
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node scripts/apply-github-rulesets.mjs
 *   node scripts/apply-github-rulesets.mjs --owner my-org --repo blessMeter
 *
 * Requires a token with admin access to the repository (classic: repo scope;
 * fine-grained: Administration read/write on the repo).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = resolve(ROOT, ".github/rulesets/config.json");

const API_VERSION = "2022-11-28";

function parseArgs(argv) {
  const args = { owner: null, repo: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--owner") args.owner = argv[++i];
    else if (argv[i] === "--repo") args.repo = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

function gitOriginOwnerRepo() {
  try {
    const remote = execSync("git remote get-url origin", { cwd: ROOT, encoding: "utf8" }).trim();
    const sshMatch = remote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }
  } catch {
    // ignore
  }
  return { owner: null, repo: null };
}

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

async function githubRequest(token, method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  }
  return data;
}

/**
 * Pull-request review bypass for the repo owner: user-owned repos use the owner
 * account; organization-owned repos use organization admins (org owners).
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 */
async function resolveRepositoryOwnerReviewBypass(token, owner, repo) {
  const repoMeta = await githubRequest(token, "GET", `/repos/${owner}/${repo}`);
  const repoOwner = repoMeta.owner;
  if (!repoOwner) {
    throw new Error("Repository owner not found in GitHub API response");
  }
  if (repoOwner.type === "User") {
    return [
      {
        actor_id: repoOwner.id,
        actor_type: "User",
        bypass_mode: "pull_request",
      },
    ];
  }
  if (repoOwner.type === "Organization") {
    return [
      {
        actor_id: 1,
        actor_type: "OrganizationAdmin",
        bypass_mode: "pull_request",
      },
    ];
  }
  throw new Error(`Unsupported repository owner type: ${repoOwner.type}`);
}

function buildRulesetBody(config, bypassActors) {
  const include = config.branches.map((branch) => `refs/heads/${branch}`);
  return {
    name: config.rulesetName,
    target: "branch",
    enforcement: "active",
    conditions: {
      ref_name: {
        include,
        exclude: [],
      },
    },
    rules: [
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [
            {
              context: config.requiredStatusCheckContext,
            },
          ],
        },
      },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: config.requiredApprovingReviewCount,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: false,
        },
      },
    ],
    bypass_actors: bypassActors,
  };
}

async function findRulesetByName(token, owner, repo, name) {
  const rulesets = await githubRequest(token, "GET", `/repos/${owner}/${repo}/rulesets`);
  if (!Array.isArray(rulesets)) {
    return null;
  }
  return rulesets.find((ruleset) => ruleset.name === name) ?? null;
}

async function main() {
  const args = parseArgs(process.argv);
  const config = loadConfig();
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Set GITHUB_TOKEN to a PAT with admin access on the repository.");
    process.exit(1);
  }

  const fromGit = gitOriginOwnerRepo();
  const owner = args.owner || fromGit.owner;
  const repo = args.repo || fromGit.repo;
  if (!owner || !repo) {
    console.error("Could not determine owner/repo. Pass --owner and --repo.");
    process.exit(1);
  }

  const bypassActors = await resolveRepositoryOwnerReviewBypass(token, owner, repo);
  const body = buildRulesetBody(config, bypassActors);
  if (args.dryRun) {
    console.log(JSON.stringify({ owner, repo, body }, null, 2));
    return;
  }

  const existing = await findRulesetByName(token, owner, repo, config.rulesetName);
  if (existing) {
    console.log(`Updating ruleset "${config.rulesetName}" (id ${existing.id})…`);
    await githubRequest(token, "PUT", `/repos/${owner}/${repo}/rulesets/${existing.id}`, body);
  } else {
    console.log(`Creating ruleset "${config.rulesetName}"…`);
    await githubRequest(token, "POST", `/repos/${owner}/${repo}/rulesets`, body);
  }

  console.log("Done.");
  console.log(`Branches: ${config.branches.join(", ")}`);
  console.log(`Required check: ${config.requiredStatusCheckContext} (from .github/workflows/ci.yml job name)`);
  console.log(`Reviews: ${config.requiredApprovingReviewCount} (repository owner may bypass reviews; CI still required)`);
  console.log(`Review bypass actors: ${JSON.stringify(bypassActors)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
