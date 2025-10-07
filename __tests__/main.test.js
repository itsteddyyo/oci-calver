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

const defaultGetInput = (input) => {
    switch (input) {
        case "repository":
            return "ghcr.io/owner/repo";
        case "registry_scheme":
            return "https";
        case "auth_mode":
            return "basic";
        case "registry_username":
            return "user";
        case "registry_password":
            return "pass";
        case "calver_format":
            return "YYYY.MM.MICRO";
        default:
            return "";
    }
};

describe("main.js", () => {
    beforeEach(() => {
        jest.useFakeTimers("modern");
        jest.setSystemTime(new Date(2025, 5, 1));

        // Set the action's inputs as return values from core.getInput().
        core.getInput.mockImplementation(defaultGetInput);

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

    it("Test output with different format (+bearer)", async () => {
        core.getInput.mockImplementation((input) => {
            if (input === "calver_format") {
                return "YYYY.0M.MICRO";
            } else if (input === "auth_mode") {
                return "bearer";
            } else {
                return defaultGetInput(input);
            }
        });

        await run();

        expect(core.setFailed).toHaveBeenCalledTimes(0);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, "current", "2022.02.0");
        expect(core.setOutput).toHaveBeenNthCalledWith(2, "new", "2025.06.0");
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
        core.getInput.mockImplementation((input) => {
            if (input === "auth_mode") {
                return "abc";
            } else {
                return defaultGetInput(input);
            }
        });

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "Invalid auth_mode: abc");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test wrong inputs - basic but no password", async () => {
        core.getInput.mockImplementation((input) => {
            if (input === "registry_password") {
                return null;
            } else {
                return defaultGetInput(input);
            }
        });

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "registry_username and registry_password are required for basic auth");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test wrong inputs - bearer but no password", async () => {
        core.getInput.mockImplementation((input) => {
            if (input === "auth_mode") {
                return "bearer";
            } else if (input === "registry_password") {
                return null;
            } else {
                return defaultGetInput(input);
            }
        });

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "registry_password (bearer token) is required for bearer auth");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });

    it("Test wrong inputs - basic but no username", async () => {
        core.getInput.mockImplementation((input) => {
            if (input === "registry_username") {
                return null;
            } else {
                return defaultGetInput(input);
            }
        });

        await run();

        expect(core.setFailed).toHaveBeenNthCalledWith(1, "registry_username and registry_password are required for basic auth");
        expect(core.setOutput).toHaveBeenCalledTimes(0);
    });
});

afterEach(() => {
    jest.resetAllMocks();
});
