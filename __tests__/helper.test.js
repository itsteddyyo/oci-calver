import {describe, expect, jest} from "@jest/globals";
import dockerhub_response from "../__fixtures__/dockerhub_response.json";
import ghcr_response from "../__fixtures__/ghcr_response.json";

const {parseDockerReference, getAPIInfo} = await import("../src/helper.js");

describe("parseDockerReference", () => {
    it("Test parseReference without registry", async () => {
        const reference = parseDockerReference("redis");

        expect(reference).toEqual({
            registry: "docker.io",
            repository: "library/redis",
        });
    });

    it("Test parseReference with docker registry", async () => {
        const reference = parseDockerReference("docker.io/redis");

        expect(reference).toEqual({
            registry: "docker.io",
            repository: "library/redis",
        });
    });

    it("Test parseReference with registry", async () => {
        const reference = parseDockerReference("ghcr.io/redis");

        expect(reference).toEqual({
            registry: "ghcr.io",
            repository: "redis",
        });
    });

    it("Test parseReference with registry and namespace", async () => {
        const reference = parseDockerReference("ghcr.io/namespace/redis");

        expect(reference).toEqual({
            registry: "ghcr.io",
            repository: "namespace/redis",
        });
    });

    it("Test parseReference failing", async () => {
        expect(() => parseDockerReference(123)).toThrow("Invalid image reference");
    });
});

describe("getAPIInfo", () => {
    it("Test getAPIInfo for docker.io", async () => {
        const APIInfo = getAPIInfo("docker.io", "https", "library/redis");
        const result = APIInfo.extractTags(dockerhub_response);
        expect(result[0]).toEqual("latest");
        expect(APIInfo.url).toEqual("https://hub.docker.com/v2/repositories/library/redis/tags");
    });
    it("Test getAPIInfo for ghcr.io", async () => {
        const APIInfo = getAPIInfo("ghcr.io", "https", "grafana/grafana-operator");
        const result = APIInfo.extractTags(ghcr_response);
        expect(result[0]).toEqual("v5.5.2");
        expect(APIInfo.url).toEqual("https://ghcr.io/v2/grafana/grafana-operator/tags/list");
    });
});

afterEach(() => {
    jest.resetAllMocks();
});
