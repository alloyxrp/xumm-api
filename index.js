const express = require('express')
const app = express()
const log = require('debug')('app:main')

async function start () {
  const middleware = [
    { type: 'middleware', module: 'config' },
    { type: 'storage', module: 'database' },
    { type: 'middleware', module: 'cors' },
    { type: 'middleware', module: 'headers' },
    { type: 'middleware', module: 'what-router' },
    { type: 'middleware', module: 'remote-addr' },
    { type: 'middleware', module: 'cli-logger' },
    { type: 'handler', module: 'web' },
    { type: 'handler', module: 'api' },
    { type: 'handler', module: 'wss' },
    { type: 'middleware', module: 'error-handler' },
    { type: 'middleware', module: 'redis-pubsub' },
  ]

  log('Loading modules') 
  for (let i = 0; i<middleware.length; i++) {
    log(` - ${middleware[i].type}: ${middleware[i].module}`)
    await require(`@src/${middleware[i].type}/${middleware[i].module}`)(app)
  }
  log('Modules loaded')

  app.listen(app.config.port)
  log(`\nXRPL-SIGN ${app.config.mode} - Server running at port ${app.config.port}\n`)
}

start()

process.on('SIGINT', async () => {
  log('--- STOPPING ---')
  process.exit(0)
})
