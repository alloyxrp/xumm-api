const fetch = require('node-fetch')
const translations = require('@src/global/translations')
const options = {
  module_name: 'payloadPushMessage',
  process_timeout: 5
}

const log = function () {
  process.send({ debug_log: arguments })
}

// TODO: Localize (now default EN) i18n

/**
 * Code
 */

const main = async (data) => {
  let timeout

  timeout = setTimeout(() => {
    log(`TIMEOUT @ ${options.module_name} [ payload(${data.payload.uuidv4}) ]`)
    process.exit(1)
  }, options.process_timeout * 1000)

  try {
    log('PUSHDATA', data.transaction)
    const url = 'https://fcm.googleapis.com/fcm/send'
    let body = translations.translate('en', 'PUSH_MSG_TXTYPE_TO_DEST', {
      type: data.transaction.type,
      destination: data.transaction.destination.known.knownaccount_name || data.transaction.destination.account
    })

    if (data.transaction.type.toLowerCase() === 'signin') {
      body = translations.translate('en', 'PUSH_MSG_SIGNIN_REQ', {
        appname: data.application.name
      })
    }

    const payload = (data.payload || {}).uuidv4 || {}
    const response = await fetch(url, {
      method: 'post',
      body: JSON.stringify({
        to: data.device.pushtoken,
        notification: {
          title: `${data.application.name}`,
          subtitle: translations.translate('en', 'PUSH_MSG_SIGN_REQUEST'),
          body: body,
          sound: 'default',
          click_action: 'SIGNTX',
          payload: typeof payload === 'string' ? payload : null
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + data.config.fcmkey
      }
    })

    const responseText = await response.text()
    log(`Webhook [ ${options.module_name} ] response text:`, responseText.slice(0, 500))
  } catch(e) {
    log(`${e.message} @ ${options.module_name} [ payload(${data.payload.uuidv4}) ]`)
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
  if (typeof msg.payload !== 'undefined' && msg.payload.uuidv4 !== 'undefined') {
    main(msg)
  } else {
    // log(`<< ${options.module_name} >> Message from parent: `, msg)
    log(`<< ${options.module_name} >> Exit, invalid message from parent: `, msg)
    process.exit(1)
  }
})
