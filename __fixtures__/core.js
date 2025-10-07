/**
 * This file is used to mock the `@actions/core` module in tests.
 */
import {jest} from "@jest/globals";
import * as core from "@actions/core";

export const debug = jest.fn();
export const error = jest.fn();
export const info = jest.fn();
export const getInput = core.getInput;
export const setOutput = jest.fn();
export const setFailed = jest.fn();
export const warning = jest.fn();
