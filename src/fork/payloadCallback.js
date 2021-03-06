const fetch = require('node-fetch')
const options = {
  module_name: 'payloadCallback',
  process_timeout: 5
}

const log = function () {
  process.send({ debug_log: arguments })
}

/**
 * Code
 */

const main = async (data) => {
  let timeout
  timeout = setTimeout(() => {
    log(`TIMEOUT @ ${options.module_name} [ payload(${data.payload_uuidv4}) ]`)
    process.exit(1)
  }, options.process_timeout * 1000)

  try {
    const response = await fetch(data.meta.url, {
      method: 'post',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const responseText = await response.text()
    log(`Webhook [ ${options.module_name} ] response text:`, responseText.slice(0, 100))
  } catch(e) {
    log(`${e.message} @ ${options.module_name} [ payload(${data.payload_uuidv4}) ]`)
    process.exit(1)
  }

  clearTimeout(timeout)
  process.exit(0)
}

/**
 * INIT
 */

process.send({ module: options.module_name, pid: process.pid })

process.on('message', msg => {
  if (typeof msg.meta !== 'undefined' && msg.meta.payload_uuidv4 !== 'undefined') {
    main(msg)
  } else {
    // log(`<< ${options.module_name} >> Message from parent: `, msg)
    log(`<< ${options.module_name} >> Exit, invalid message from parent: `, msg)
    process.exit(1)
  }
})
