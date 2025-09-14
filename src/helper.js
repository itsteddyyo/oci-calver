export function parseOciReference(ref) {
    if (!ref || typeof ref !== "string") {
        throw new Error("Invalid image reference");
    }

    const parts = ref.split("/");
    let host, repoPath;

    if (parts.length > 1 && (parts[0].includes(".") || parts[0].includes(":") || parts[0] === "localhost")) {
        // Registry explicitly specified
        host = parts[0];
        repoPath = parts.slice(1).join("/");
    } else {
        // Default to Docker Hub
        host = "docker.io";
        repoPath = ref;
    }

    // Only Docker Hub has the implicit "library" namespace
    if (host === "docker.io" && !repoPath.includes("/")) {
        repoPath = `library/${repoPath}`;
    }

    // Only Docker Hub has other domain for the API
    let apiHost = host;
    if (host === "docker.io") {
        apiHost = "hub.docker.com";
    }

    return {host, apiHost, repo: repoPath};
}
