const DOMContentLoad = new Promise((resolve) => {
  console.log('DOM CONTENT LOADED')
  document.addEventListener("DOMContentLoaded", resolve);
})

function networkIdleCallback(fn, options = { timeout: 0 }) {
  // Call the function immediately if required features are absent
  if (!'MessageChannel' in window || !'serviceWorker' in navigator) {
    DOMContentLoad.then(() => fn({ didTimeout: false }))
    return
  }

  if (!navigator.serviceWorker.controller) {
    console.log(navigator.serviceWorker.controller)
    console.warn('`networkIdleCallback` was called before a service worker was registered. `networkIdleCallback` is ineffective without a working service worker')
    DOMContentLoad.then(() => fn({ didTimeout: false }))
    return
  }

  const messageChannel = new MessageChannel();
  console.log('queued up new function')
  navigator.serviceWorker.controller
    .postMessage(
      'NETWORK_IDLE_ENQUIRY',
      [messageChannel.port2],
    )

  const timeoutId = setTimeout(() => {
    console.log('timeout expired')
    const cbToPop = networkIdleCallback.__callbacks__.find(cb => cb.id === timeoutId)
    networkIdleCallback.__popCallback__(cbToPop, true)
  }, options.timeout)

  networkIdleCallback.__callbacks__.push({
    id: timeoutId,
    fn,
    timeout: options.timeout,
  })

  console.log('callback queue', networkIdleCallback.__callbacks__)
  messageChannel.port1.addEventListener('message', handleMessage);
  messageChannel.port1.start();
}

function cancelNetworkIdleCallback(callbackId) {
  clearTimeout(callbackId)

  networkIdleCallback.__callbacks__ = networkIdleCallback.__callbacks__
    .find(cb => cb.id === callbackId)
}

networkIdleCallback.__popCallback__ = (callback, didTimeout) => {
  DOMContentLoad.then(() => {
    const cbToPop = networkIdleCallback.__callbacks__
      .find(cb => cb.id === callback.id)

    if (cbToPop) {
      console.log('callback popped')
      cbToPop.fn({ didTimeout })
      clearTimeout(cbToPop.id)
      networkIdleCallback.__callbacks__ = networkIdleCallback.__callbacks__.filter(
        cb => cb.id !== callback.id)
      console.log('after popping, queue', networkIdleCallback.__callbacks__)
    }
  })
}

networkIdleCallback.__callbacks__ = []

if ('serviceWorker' in navigator)
  navigator.serviceWorker.addEventListener('message', handleMessage)

function handleMessage(event) {
  console.log('received message from service worker', event.data)

  if (!event.data)
    return

  switch (event.data) {
    case 'NETWORK_IDLE_ENQUIRY_RESULT_IDLE':
    case 'NETWORK_IDLE_CALLBACK':
      window.dispatchEvent(new CustomEvent('__networkidle__'))
      console.log(event.data.type, 'network callback received from sw, popping all', networkIdleCallback.__callbacks__)
      networkIdleCallback.__callbacks__.forEach(callback => {
        networkIdleCallback.__popCallback__(callback, false)
      })
      break;
  }
}

module.exports = {
  networkIdleCallback,
  cancelNetworkIdleCallback,
}