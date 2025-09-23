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

const defaultGetInput = (input) => {
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
}

describe('main.js', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern')
    jest.setSystemTime(new Date(2025, 5, 1))

    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation(defaultGetInput)

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tags: [
            '2022.01.0',
            '2022.01.1',
            '2022.02.0',
            '2023.1.0',
            '2023.1.1',
            '2023.2.0',
            'latest',
            'stable'
          ]
        })
    })
  })

  it('Test output', async () => {
    await run()

    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'current', '2023.2.0')
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'new', '2025.6.0')
  })

  it('Test output with micro update', async () => {
    jest.setSystemTime(new Date(2023, 1, 1))

    await run()

    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'current', '2023.2.0')
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'new', '2023.2.1')
  })

  it('Test output with different format', async () => {
    core.getInput.mockImplementation((input) => {
      if (input === 'calver_format') {
        return 'YYYY.0M.MICRO'
      } else {
        return defaultGetInput(input)
      }
    })

    await run()

    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'current', '2022.02.0')
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'new', '2025.06.0')
  })

  it('Test failed output', async () => {
    core.setFailed.mockImplementation()
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve()
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setOutput).toHaveBeenCalledTimes(0)
  })
})

afterEach(() => {
  jest.resetAllMocks()
})
