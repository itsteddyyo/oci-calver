import * as core from "@actions/core";
import * as calver from "@lets-release/calver";
import {getAPIInfo, parseDockerReference} from "./helper.js";

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
    try {
        const calverFormat = core.getInput("calver_format", {required: false, trimWhitespace: true});
        const calverPrefix = core.getInput("calver_prefix", {required: false, trimWhitespace: true});

        let tags = await getDockerTags();
        core.info(`Found ${tags.length} tags`);
        core.debug(`Tags: ${tags.join(",")}`);

        if (calverPrefix != "") {
            const prefixRegex = new RegExp(`^${calverPrefix}`, "g");
            tags = tags.map((tag) => tag.replace(prefixRegex, ""));
            core.debug(`Stripped prefix '${calverPrefix}' from tags`);
        }

        const validTags = [];
        for (const tag of tags) {
            if (calver.isValidCalVer(calverFormat, tag)) {
                validTags.push(tag);
            } else {
                core.debug(`Skipping non-calver tag: ${tag}`);
            }
        }

        core.debug(`Valid calver tags: ${validTags.join(",")}`);

        const currentTag = calver.getLatestCalVer(calverFormat, validTags);
        core.debug(`Current tag: ${currentTag || "none"}`);

        const fallbackTag = calver.formatCalVer(calverFormat, {
            tokenValues: {
                year: new Date().getFullYear(),
                month: new Date().getMonth(), // last month so no +1
                micro: 0,
            },
        });

        let newTag = null;
        try {
            newTag = calver.increaseCalVer("major", calverFormat, currentTag || fallbackTag);
        } catch (err) {
            newTag = calver.increaseCalVer("micro", calverFormat, currentTag || fallbackTag);
        }
        core.info(`Computed calver: ${newTag}`);

        if (calverPrefix != "") {
            core.setOutput("current", currentTag ? `${calverPrefix}${currentTag}` : currentTag);
            core.setOutput("new", `${calverPrefix}${newTag}`);
            core.debug(`Adding prefix '${calverPrefix}' to tags`);
        } else {
            core.setOutput("current", currentTag);
            core.setOutput("new", newTag);
        }
    } catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) core.setFailed(error.message);
    }
}

async function getDockerTags() {
    const repo = core.getInput("repository", {required: true, trimWhitespace: true});
    const authMode = core.getInput("auth_mode", {required: false, trimWhitespace: true});
    const scheme = core.getInput("registry_scheme", {required: false, trimWhitespace: true});
    const username = core.getInput("registry_username", {required: authMode == "basic", trimWhitespace: true});
    const password = core.getInput("registry_password", {required: ["basic", "bearer"].includes(authMode), trimWhitespace: true});

    const parsedRepo = parseDockerReference(repo);
    const APIInfo = getAPIInfo(parsedRepo.registry, scheme, parsedRepo.repository);

    if (!["noauth", "basic", "bearer"].includes(authMode)) {
        throw new Error(`Invalid auth_mode: ${authMode}`);
    }

    const headers = {Accept: "application/json"};
    if (authMode == "basic") {
        const token = Buffer.from(`${username}:${password}`).toString("base64");
        headers["Authorization"] = `Basic ${token}`;
    } else if (authMode == "bearer") {
        headers["Authorization"] = `Bearer ${password}`;
    }

    let res;
    try {
        res = await fetch(APIInfo.url, {headers});
    } catch (err) {
        throw new Error(`Failed to call registry: ${err.message}`);
    }

    if (res.status == 404) {
        core.info("Repository does not exist. Assuming no tags.");
        return [];
    }

    if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
    }

    let data;
    try {
        data = await res.json();
    } catch (err) {
        throw new Error(`Failed to parse registry JSON: ${err.message}`);
    }

    return APIInfo.extractTags(data);
}
