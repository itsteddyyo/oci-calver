/**
 * Unit tests for the action's main functionality, src/main.js
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import {jest} from "@jest/globals";
import * as core from "../__fixtures__/core.js";

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core);

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const {run} = await import("../src/main.js");
const OLD_ENV = {...process.env};

describe("main.js", () => {
    beforeEach(() => {
        jest.useFakeTimers("modern");
        jest.setSystemTime(new Date(2025, 5, 1));

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    tags: ["2022.01.0", "2022.01.1", "2022.02.0", "2023.1.0", "2023.1.1", "2023.2.0", "latest", "stable"],
                }),
        });
    });

    it("Test output", async () => {
        await run();

        expect(core.setFailed).toHaveBeenCalledTimes(0);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, "current", "2023.2.0");
        expect(core.setOutput).toHaveBeenNthCalledWith(2, "new", "2025.6.0");
    });

    it("Test output with micro update", async () => {
        jest.setSystemTime(new Date(2023, 1, 1));

        await run();

        expect(core.setFailed).toHaveBeenCalledTimes(0);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, "current", "2023.2.0");
        expect(core.setOutput).toHaveBeenNthCalledWith(2, "new", "2023.2.1");
    });

    it("Test output with different format", async () => {
        process.env["INPUT_CALVER_FORMAT"] = "YYYY.0M.MICRO";

        await run();

        expect(core.setFailed).toHaveBeenCalledTimes(0);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, "current", "2022.02.0");
        expect(core.setOutput).toHaveBeenNthCalledWith(2, "new", "2025.06.0");
    });

    it("Test output with prefix", async () => {
        process.env["INPUT_CALVER_PREFIX"] = "v";

        await run();

        expect(core.setFailed).toHaveBeenCalledTimes(0);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, "current", "v2023.2.0");
        expect(core.setOutput).toHaveBeenNthCalledWith(2, "new", "v2025.6.0");
    });

    it("Test output with non-existing repo", async () => {
        core.setFailed.mockImplementation();
        global.fetch = jest.fn().mockResolvedValue({
            status: 404,
        });

        await run();

        expect(core.setFailed).toHaveBeenCalledTimes(0);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, "current", undefined);
        expect(core.setOutput).toHaveBeenNthCalledWith(2, "new", "2025.6.0");
    });

    it("Test output with non-handled status", async () => {
        core.setFailed.mockImplementation();
        global.fetch = jest.fn().mockResolvedValue({
            status: 418,
            statusText: "I'm a teapot",
        });

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "418: I'm a teapot");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test output with non-handled body", async () => {
        core.setFailed.mockImplementation();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.reject(new Error("Invalid JSON")),
        });

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "Failed to parse registry JSON: Invalid JSON");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test failed api call", async () => {
        core.setFailed.mockImplementation();
        global.fetch = jest.fn().mockRejectedValue(new Error("Network Error"));

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "Failed to call registry: Network Error");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test wrong inputs - unknown auth method", async () => {
        process.env["INPUT_AUTH_MODE"] = "abc";

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "Invalid auth_mode: abc");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test wrong inputs - basic but no password", async () => {
        process.env["INPUT_AUTH_MODE"] = "basic";
        process.env["INPUT_REGISTRY_PASSWORD"] = null;

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "Input required and not supplied: registry_password");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test wrong inputs - bearer but no password", async () => {
        process.env["INPUT_AUTH_MODE"] = "bearer";
        process.env["INPUT_REGISTRY_PASSWORD"] = null;

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "Input required and not supplied: registry_password");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test wrong inputs - basic but no username", async () => {
        process.env["INPUT_AUTH_MODE"] = "basic";
        process.env["INPUT_REGISTRY_USERNAME"] = null;

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "Input required and not supplied: registry_username");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });
});

afterEach(() => {
    jest.resetAllMocks();
    process.env = {...OLD_ENV};
});
