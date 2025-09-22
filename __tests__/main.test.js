/**
 * Unit tests for the action's main functionality, src/main.js
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.js', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern')
    jest.setSystemTime(new Date(2025, 9, 1))

    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((input) => {
      switch (input) {
        case 'oci_repository':
          return 'ghcr.io/owner/repo'
        case 'oci_registry_scheme':
          return 'https'
        case 'auth_mode':
          return 'basic'
        case 'registry_username':
          return 'user'
        case 'registry_password':
          return 'pass'
        case 'timeout_seconds':
          return '1'
        case 'calver_format':
          return 'YYYY.MM.MICRO'
        default:
          return ''
      }
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tags: ['2023.1.0', '2023.1.1', '2023.2.0', 'latest', 'stable']
        })
    })
  })

  it('Test output', async () => {
    await run()

    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'current', '2023.2.0')
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'new', '2025.10.0')
  })
})

afterEach(() => {
  jest.resetAllMocks()
})
