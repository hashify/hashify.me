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

corsNotSupported = ->
  Hashify.channel.broadcast 'textchange', '''
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
    json = JSON.parse request.responseText
    if json.status_code is 200 then success json.data
    else Hashify.channel.broadcast 'request:error', json
  try
    request.send()
  catch error
    throw error unless error.message is 'Security violation' # Opera
    do corsNotSupported

Hashify.utils = {$, addEvent, decode, sendRequest}
