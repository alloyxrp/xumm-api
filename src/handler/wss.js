const logws = require('debug')('app:web:ws')
const jwt = require('../middleware/auth/devconsole-jwt')

const express = require('express')

module.exports = async function (expressApp) {
  require('express-ws')(expressApp)

  /**
   * WebSocket Router
   */
  const router = express.Router()

  // Sign page, users, visitors
  router.ws('/sign/:uuid([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12})', (ws, req) => {
    if (typeof req.params.uuid !== undefined) {
      req.db(`
        UPDATE
          payloads
        SET
          payload_ws_opencount = payload_ws_opencount + 1
        WHERE
          call_uuidv4 = :call_uuidv4
        LIMIT 1
      `, { call_uuidv4: req.params.uuid }).then(r => {
        if (r.constructor.name === 'OkPacket' && typeof r.changedRows !== undefined && r.changedRows > 0) {
          logws('Websocket connected:', req.params.uuid)
          const pubSubChannel = `sign:${req.params.uuid}`
    
          ws.sendJson = (data) => {
            const json = JSON.stringify(data)
            try {
              ws.send(json)
            } catch (e) {}
          }
    
          const redisMessageHandler = expressApp.redis.subscribe(pubSubChannel, (message) => {
            try {
              const json = JSON.parse(message)
              logws(`  < PubSub MSG @ [ ${pubSubChannel} ]`, json)
              ws.sendJson(json)
            } catch (e) {
              logws(`  < PubSub MSG @ [ ${pubSubChannel} ] ! NON JSON`)
            }
          })
    
          ws.sendJson({ message: `Welcome ` + req.params.uuid })
          ws.on('close', () => {
            logws('Bye', req.params.uuid)
            redisMessageHandler.destroy()
          })
          ws.on('message', (msg) => {
            logws(`Got WebSocket message from [ ${req.params.uuid} ] `, msg)
            ws.sendJson({ message: `Right back at you!` })
          })
        }
      })
    }
  })

  // App admin console
  router.ws('/app/:uuid([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12})', (ws, req) => {
    const authMsg = `Please send { auth: 'SomeBase64JWT' } command to authorize this socket.`
    const pubSubChannel = `app:${req.params.uuid}`
    let redisMessageHandler
    let authorized

    const authTimeout = setTimeout(() => {
      const nonAuthMsg = `Sorry, closing connection: auth timeout.`
      logws(nonAuthMsg)
      ws.sendJson({ message: nonAuthMsg })
      ws.close()
    }, 5 * 1000)

    ws.sendJson = (data) => {
      const json = JSON.stringify(data)
      try {
        ws.send(json)
      } catch (e) {}
    }

    ws.on('close', () => {
      logws('Bye', req.params.uuid)
      if (typeof redisMessageHandler !== 'undefined') {
        redisMessageHandler.destroy()
      }
    })

    ws.on('message', (msg) => {
      logws(`Got WebSocket message from [ ${req.params.uuid} ] `, msg)
      if (typeof authorized === 'undefined') {
        try {
          const json = JSON.parse(msg)
          const bearer = json.auth.trim().split(' ').reverse()[0]
          req.headers.authorization = `Bearer ${bearer}`
          const jwtAuth = jwt(expressApp, req, {
              set () {},
              handleError (e) {
                logws('handleError', e.message)
              }
            }, { route: req })
            jwtAuth.then(r => {
              authorized = r
              ws.sendJson({ message: `Welcome '${r.jwt_sub}' :D You're now authorized! Now just wait for updates to [${pubSubChannel}].` })
              clearTimeout(authTimeout)
              redisMessageHandler = req.app.redis.subscribe(pubSubChannel, message => {
                try {
                  const json = JSON.parse(message)
                  logws(`  < DevConsole [${pubSubChannel}] PubSub MSG @ [ ${pubSubChannel} ]`, json)
                  ws.sendJson(json)
                } catch (e) {
                  logws(`  < DevConsole [${pubSubChannel}] PubSub MSG @ [ ${pubSubChannel} ] ! NON JSON`)
                }
              })
            }).catch(e => {
              ws.sendJson({ message: `Invalid JWT` })
              logws('jwtAuthCatch', e.message)
            })
        } catch (e) {
          ws.sendJson({ message: authMsg })
        }
      } else {
        ws.sendJson({ message: `Auth valid :) Right back at you!` })
      }
    })

    ws.sendJson({ message: `Welcome ${req.params.uuid}. ${authMsg}` })
  })

  // Use
  expressApp.use('/wss', router)
}
