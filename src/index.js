require('babel-polyfill')

import defaultAxios from "axios"
import cookie from "js-cookie"
import param from "jquery-param"

class AxiosApiClient {
  errors = {
    UNAUTHENTICATED: { type: "unauthenticated" },
    WRONG_CREDENTIALS: { type: "wrong_credentials" }
  }

  paths = {
    oauthTokenPath: "oauth/token",
    signOutPath: "sign_out"
  }

  constructor({ access_token, refresh_token, apiUrl, axios, headers = {}, paths = {} }) {
    this.axios = axios || defaultAxios
    this.access_token = access_token || cookie.get("access_token") || null
    this.refresh_token = refresh_token || cookie.get("refresh_token") || null
    this.headers = headers
    this.settings = {
      paramsSerializer: params => param(params),
      responseType: "json",
      baseURL: apiUrl
    }

    Object.assign(this.paths, paths)
  }

  ready() {
    return this.access_token !== null
  }

  setCredentials({ access_token, refresh_token }) {
    if (typeof access_token !== "undefined") {
      this.access_token = access_token
      if (access_token === null) {
        cookie.remove("access_token")
      } else {
        cookie.set("access_token", access_token, { path: "/" })
      }
    }

    if (typeof refresh_token !== "undefined") {
      this.refresh_token = refresh_token
      if (refresh_token === null) {
        cookie.remove("refresh_token")
      } else {
        cookie.set("refresh_token", refresh_token, { path: "/" })
      }
    }
  }

  resetCredentials() {
    return this.setCredentials({ access_token: null, refresh_token: null })
  }

  rollbackSession() {
    this.setCredentials({
      access_token: cookie.get("rollback_access_token"),
      refresh_token: cookie.get("rollback_refresh_token")
    })

    cookie.remove("rollback_access_token")
    cookie.remove("rollback_refresh_token")
  }

  async get(endpoint, params = {}, opts = {}) {
    return await this.send(
      Object.assign({ method: "get", endpoint: endpoint, params: params }, opts)
    )
  }

  async post(endpoint, payload = {}, opts = {}) {
    return await this.send(
      Object.assign({ method: "post", endpoint: endpoint, payload: payload }, opts)
    )
  }

  async put(endpoint, payload = {}, opts = {}) {
    return await this.send(
      Object.assign({ method: "put", endpoint: endpoint, payload: payload }, opts)
    )
  }

  async patch(endpoint, payload = {}, opts = {}) {
    return await this.send(
      Object.assign({ method: "patch", endpoint: endpoint, payload: payload }, opts)
    )
  }
  async delete(endpoint, payload = {}, opts = {}) {
    return await this.send(
      Object.assign({ method: "delete", endpoint: endpoint, payload: payload }, opts)
    )
  }

  async send(request) {
    const {
      method = "get",
      endpoint,
      payload = {},
      authentication = !!this.access_token,
      headers = {},
      refresh_authentication = true,
      params
    } = request

    // if (authentication && !this.access_token) {
    //   throw this.errors.UNAUTHENTICATED
    // }

    Object.assign(headers, this.headers)

    if (authentication) {
      headers["Authorization"] = `bearer ${this.access_token}`
    }

    try {
      const response = await this.axios({
        method,
        headers,
        params,
        url: endpoint,
        data: payload,
        ...this.settings
      })

      const result = response.data

      return result
    } catch (error) {
      if (
        error.response &&
        error.response.status === 401 &&
        refresh_authentication
      ) {
        try {
          await this.refreshOauthToken()
          return this.send(request) // retry
        } catch (e) {
          throw this.errors.UNAUTHENTICATED
        }
      } else {
        throw error
      }
    }
  }

  async requestOauthToken(email, password) {
    try {
      const response = await this.axios.post(
        this.paths.oauthTokenPath,
        {
          grant_type: "password",
          email: email,
          password: password
        },
        { ...this.settings }
      )

      this.setCredentials(response.data)
    } catch (error) {
      if (error.response && Number(error.response.status) === 401) {
        throw this.errors.WRONG_CREDENTIALS
      } else {
        throw error
      }
    }
  }

  async refreshOauthToken() {
    try {
      const response = await this.axios.post(
        this.paths.oauthTokenPath,
        {
          grant_type: "refresh_token",
          refresh_token: this.refresh_token
        },
        { ...this.settings }
      )

      this.setCredentials(response.data)
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw this.errors.WRONG_CREDENTIALS
      } else {
        throw error
      }
    }
  }

  clearSession() {
    this.resetCredentials()
    if (cookie.get("rollback_access_token")) this.rollbackSession()

    return true
  }
}

export default AxiosApiClient

