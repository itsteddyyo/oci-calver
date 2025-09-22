import * as core from '@actions/core'
import * as calver from '@lets-release/calver'
import { parseOciReference } from './helper.js'

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    const calverFormat = core.getInput('calver_format') || 'YYYY.MM.MICRO'

    const tags = await getOciTags()
    core.info(`Found ${tags.length} tags`)
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

    const currentTag = calver.getLatestCalVer(calverFormat, validTags)
    core.debug(`Current tag: ${currentTag || 'none'}`)

    const fallbackTag = calver.formatCalVer(calverFormat, {
      tokenValues: {
        year: new Date().getFullYear(),
        month: new Date().getMonth(), // last month so no +1
        micro: 0
      }
    })

    let newTag = null
    try {
      newTag = calver.increaseCalVer(
        'major',
        calverFormat,
        currentTag || fallbackTag
      )
    } catch (err) {
      newTag = calver.increaseCalVer(
        'micro',
        calverFormat,
        currentTag || fallbackTag
      )
    }
    core.info(`Computed calver: ${newTag}`)

    core.setOutput('current', currentTag)
    core.setOutput('new', newTag)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function getOciTags() {
  const authMode = core.getInput('auth_mode') || 'basic'
  const username = core.getInput('registry_username')
  const password = core.getInput('registry_password')
  const scheme = core.getInput('oci_registry_scheme') || 'https'
  const ociRepo = core.getInput('oci_repository', { required: true })

  const parsedRepo = parseOciReference(ociRepo)
  const url = `${scheme}://${parsedRepo.host}/v2/${parsedRepo.repo}/tags/list`
  const timeoutSeconds = parseInt(core.getInput('timeout_seconds') || '10', 10)

  if (!['noauth', 'basic', 'bearer'].includes(authMode)) {
    throw new Error(`Invalid auth_mode: ${authMode}`)
  }
  if (authMode == 'basic' && (!username || !password)) {
    throw new Error(
      `registry_username and registry_password are required for basic auth`
    )
  }
  if (authMode == 'bearer' && !password) {
    throw new Error(
      'registry_password (bearer token) is required for bearer auth'
    )
  }

  const headers = { Accept: 'application/json' }
  if (authMode == 'basic') {
    const token = Buffer.from(`${username}:${password}`).toString('base64')
    headers['Authorization'] = `Basic ${token}`
  } else if (authMode == 'bearer') {
    headers['Authorization'] = `Bearer ${password}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000)

  let res
  try {
    res = await fetch(url, { headers, signal: controller.signal })
  } catch (err) {
    throw new Error(`Failed to call registry: ${err.message}`)
  } finally {
    clearTimeout(timeout)
  }

  if (res.status == 404) {
    core.info('Repository does not exist. Assuming no tags.')
    return []
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Registry returned ${res.status}: ${body}`)
  }

  let data
  try {
    data = await res.json()
  } catch (err) {
    throw new Error(`Failed to parse registry JSON: ${err.message}`)
  }

  const tags = Array.isArray(data.tags) ? data.tags : []
  return tags
}
