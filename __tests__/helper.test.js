import {jest} from "@jest/globals";

const {parseDockerReference} = await import("../src/helper.js");

describe("helper.js", () => {
    it("Test parseReference without registry", async () => {
        const reference = parseDockerReference("redis");

        expect(reference).toEqual({
            host: "docker.io",
            apiHost: "hub.docker.com",
            repo: "library/redis",
        });
    });

    it("Test parseReference with docker registry", async () => {
        const reference = parseDockerReference("docker.io/redis");

        expect(reference).toEqual({
            host: "docker.io",
            apiHost: "hub.docker.com",
            repo: "library/redis",
        });
    });

    it("Test parseReference with registry", async () => {
        const reference = parseDockerReference("ghcr.io/redis");

        expect(reference).toEqual({
            host: "ghcr.io",
            apiHost: "ghcr.io",
            repo: "redis",
        });
    });

    it("Test parseReference with registry and namespace", async () => {
        const reference = parseDockerReference("ghcr.io/namespace/redis");

        expect(reference).toEqual({
            host: "ghcr.io",
            apiHost: "ghcr.io",
            repo: "namespace/redis",
        });
    });

    it("Test parseReference failing", async () => {
        expect(() => parseDockerReference(123)).toThrow("Invalid image reference");
    });
});

afterEach(() => {
    jest.resetAllMocks();
});
