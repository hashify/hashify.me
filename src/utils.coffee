$ = (id) -> document.getElementById id

addEvent = (el, type, handler) ->
  if el.addEventListener
    el.addEventListener type, handler, no
  else if el.attachEvent
    el.attachEvent "on#{type}", handler

decode = (text) ->
  try Hashify.decode text
  catch error
    throw error unless error instanceof URIError
    '# ' + error

parseJSON = (data) ->
  return null unless typeof data is 'string' and data

  data = data.replace /^\s+|\s+$/g, ''

  throw new SyntaxError 'Invalid JSON' unless /^[\],:{}\s]*$/.test data
    .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g, ']')
    .replace(/(?:^|:|,)(?:\s*\[)+/g, '')

  if window.JSON?.parse then JSON.parse data
  else do new Function "return #{data}"

corsNotSupported = ->
  publish 'textchange', '''
    # I'm sorry, Dave

    Your browser appears not to support
    [cross-origin resource sharing][1].


    [1]: http://en.wikipedia.org/wiki/Cross-Origin_Resource_Sharing
  '''

sendRequest = (action, params, success) ->
  request = new XMLHttpRequest()
  try
    request.open 'GET',
      "http://api.bitly.com/v3/#{action}?login=davidchambers&" +
      "apiKey=R_20d23528ed6381ebb614a997de11c20a&#{params}"
  catch error
    # NS_ERROR_DOM_BAD_URI
    if error.code is 1012 or /^Access is denied\.\r\n$/.test error.message
      do corsNotSupported
      return
    throw error

  request.onreadystatechange = ->
    return unless request.readyState is 4 and request.status is 200
    json = parseJSON request.responseText
    if json.status_code is 200 then success json.data
    else publish 'request:error', json
  try
    request.send()
  catch error
    throw error unless error.message is 'Security violation' # Opera
    do corsNotSupported

subscriptions = {}

subscribe = (event, action) ->
  (subscriptions[event] or= []).push action

stack = []
publish = (event, args...) ->
  return if event in stack # prevent recursion
  stack.push event
  # A "pre:" hook may modify the published arguments before they're
  # passed to the remaining event listeners (by returning an array),
  # or it may cancel the event (by returning a falsy value).
  cancelled = no
  for s in subscriptions["pre:#{event}"] or []
    unless args = s args...
      cancelled = yes
      break
  unless cancelled
    s args... for s in subscriptions[event] or []
    s args... for s in subscriptions["post:#{event}"] or []
  stack.pop()

Hashify.utils = {$, addEvent, decode, publish, sendRequest, subscribe}
