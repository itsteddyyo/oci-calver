import * as core from '@actions/core'
import * as calver from '@lets-release/calver'

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    const ociRepo = core.getInput('oci_repository', { required: true })
    const authMode = core.getInput('auth_mode') || 'basic'
    const username = core.getInput('registry_username')
    const password = core.getInput('registry_password')
    const scheme = core.getInput('oci_registry_scheme') || 'https'
    const timeoutSeconds = parseInt(
      core.getInput('timeout_seconds') || '10',
      10
    )
    const calverFormat = core.getInput('calver_format') || 'YYYY.MM.MICRO'

    if (!['noauth', 'basic', 'bearer'].includes(authMode)) {
      core.setFailed(`Invalid auth_mode: ${authMode}`)
      return
    }
    if (authMode === 'basic' && (!username || !password)) {
      core.setFailed(
        'registry_username and registry_password are required for basic auth'
      )
      return
    }
    if (authMode === 'bearer' && !password) {
      core.setFailed(
        'registry_password (bearer token) is required for bearer auth'
      )
      return
    }

    const parsedRepo = parseOciReference(ociRepo)

    const url = `${scheme}://${parsedRepo.host}/v2/${parsedRepo.repo}/tags/list`

    const headers = { Accept: 'application/json' }
    if (authMode === 'basic') {
      const token = Buffer.from(`${username}:${password}`).toString('base64')
      headers['Authorization'] = `Basic ${token}`
    } else if (authMode === 'bearer') {
      headers['Authorization'] = `Bearer ${password}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000)

    let res
    try {
      res = await fetch(url, { headers, signal: controller.signal })
    } catch (err) {
      core.setFailed(`Failed to call registry: ${err.message}`)
      return
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      const body = await res.text()
      core.setFailed(`Registry returned ${res.status}: ${body}`)
      return
    }

    let data
    try {
      data = await res.json()
    } catch (err) {
      core.setFailed(`Failed to parse registry JSON: ${err.message}`)
      return
    }

    const tags = Array.isArray(data.tags) ? data.tags : []
    tags.push('latest')
    core.info(`Found ${tags.length} tags in ${ociRepo}`)
    core.debug(`Tags: ${tags.join(',')}`)
    const validTags = []
    for (const tag of tags) {
      if (calver.isValidCalVer(calverFormat, tag)) {
        validTags.push(tag)
      } else {
        core.debug(`Skipping non-calver tag: ${tag}`)
      }
    }

    core.debug(`Valid calver tags: ${validTags.join(',')}`)

    let newestTag = calver.getLatestCalVer(calverFormat, validTags)
    core.debug(`Current tag: ${newestTag || 'none'}`)

    if (!newestTag) {
      newestTag = calver.formatCalVer(calverFormat, {
        tokenValues: {
          year: new Date().getFullYear(),
          month: new Date().getMonth(), // last month so no +1
          micro: 0
        }
      })
    }

    try {
      newestTag = calver.increaseCalVer('major', calverFormat, newestTag || '')
    } catch (err) {
      newestTag = calver.increaseCalVer('micro', calverFormat, newestTag || '')
    }

    core.setOutput('calver', newestTag)
    core.info(`Computed calver: ${newestTag}`)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function parseOciReference(ref) {
  if (!ref || typeof ref !== 'string') {
    throw new Error('Invalid image reference')
  }

  const parts = ref.split('/')
  let host, repoPath

  if (
    parts.length > 1 &&
    (parts[0].includes('.') ||
      parts[0].includes(':') ||
      parts[0] === 'localhost')
  ) {
    // Registry explicitly specified
    host = parts[0]
    repoPath = parts.slice(1).join('/')
  } else {
    // Default to Docker Hub
    host = 'docker.io'
    repoPath = ref
  }

  // Only Docker Hub has the implicit "library" namespace
  if (host === 'docker.io' && !repoPath.includes('/')) {
    repoPath = `library/${repoPath}`
  }

  return { host, repo: repoPath }
}
