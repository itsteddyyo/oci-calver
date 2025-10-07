export function parseDockerReference(ref) {
    if (!ref || typeof ref !== "string") {
        throw new Error("Invalid image reference");
    }

    const parts = ref.split("/");
    let registry, repoPath;

    if (parts.length > 1 && (parts[0].includes(".") || parts[0].includes(":") || parts[0] === "localregistry")) {
        // Registry explicitly specified
        registry = parts[0];
        repoPath = parts.slice(1).join("/");
    } else {
        // Default to Docker Hub
        registry = "docker.io";
        repoPath = ref;
    }

    // Only Docker Hub has the implicit "library" namespace
    if (registry === "docker.io" && !repoPath.includes("/")) {
        repoPath = `library/${repoPath}`;
    }

    return {registry, repository: repoPath};
}

export function getAPIInfo(registry, registryScheme, repository) {
    switch (registry) {
        case "docker.io":
            return {
                url: `${registryScheme}://hub.docker.com/v2/repositories/${repository}/tags`,
                extractTags: (data) => (data.results || []).map((tag) => tag.name),
            };
        default:
            // Generic Docker Registry API v2 endpoint
            return {
                url: `${registryScheme}://${registry}/v2/${repository}/tags/list`,
                extractTags: (data) => data.tags || [],
            };
    }
}
