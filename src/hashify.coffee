$ = (id) -> document.getElementById id

body = document.body

dragger = $('dragger')

editor = $('markdown')

kbdShortcuts = $('kbd-shortcuts')

markup = $('markup')

qrcode = $('qrcode')

shorten = $('shorten')

sidebar = $('sidebar')

wrapper = $('wrapper')

bitlyLimit = 15

draggerPosition = undefined

dragging = undefined

hashifyMe = do ->
  {protocol, hostname, port} = location
  "#{ protocol }//#{ hostname }#{ if port then ':' + port else '' }/"

hashifyMeLen = hashifyMe.length

lastEditorValue = undefined

lastSavedDocument = undefined

localStorage = window.localStorage or {}

maxHashLength = 2048 - hashifyMe.length

preferredWidth = +localStorage.w or 0

presentationModeSpecified = -> queryContains 'mode:presentation'

pushStateExists = window.history?.pushState

queryContains = (option) ->
  RegExp("[?;]#{ option }(;|$)").test documentComponents()[2]

sidebarVisibleWidth = sidebarMinimumWidth =
  # From [https://developer.mozilla.org/en/DOM:window.getComputedStyle]:
  #
  # > Prior to Gecko 2.0 (Firefox 4 / Thunderbird 3.3 / SeaMonkey 2.1),
  # > the `pseudoElt` parameter was required. No other major browser
  # > required this parameter be specified if null. Gecko has been
  # > changed to match the behavior of other browsers.
  parseInt window.getComputedStyle(sidebar, null).getPropertyValue('width'), 10

windowWidth = undefined

_ =
  subs: {}
  sub: (event, action) ->
    _.subs[event] = action
  pub: (event, args...) ->
    if action = _.subs[event]
      action args...
      delete _.subs[event]

{convert} = new Showdown 'datetimes', 'abbreviations'

{encode} = Hashify

decode = (text) ->
  try
    Hashify.decode text
  catch error
    throw error unless error instanceof URIError
    '# ' + error

documentComponents = ->
  {pathname, search, hash} = location
  /^#!\/([^?]*)(\?.*)?$/.exec(hash) or [null, pathname.substr(1), search]

documentHash = ->
  documentComponents()[1]

highlight = do ->
  # This is a live collection:
  nodeList = document.getElementsByTagName 'code'
  ->
    node.className = 'prettyprint' for node in nodeList
    do prettyPrint

parseJSON = (data) ->
  return null unless typeof data is 'string' and data

  data = data.replace /^\s+|\s+$/g, ''

  throw new SyntaxError 'Invalid JSON' unless /^[\],:{}\s]*$/.test data
    .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g, ']')
    .replace(/(?:^|:|,)(?:\s*\[)+/g, '')

  if window.JSON?.parse then JSON.parse data
  else do new Function "return #{data}"

prettifyInUse = ->
  not /[?;]prettify:no(;|$)/.test documentComponents()[2]

queryString = (presentationMode) ->
  pairs = []
  if presentationMode
    pairs.push 'mode:presentation'
  if not prettifyInUse()
    pairs.push 'prettify:no'
  if queryContains 'raw:yes'
    pairs.push 'raw:yes'

  text = pairs.join ';'
  text and '?' + text

resizeSidebar = do ->
  px = 'px'
  markupStyle = markup.style
  sidebarStyle = sidebar.style

  (width) ->
    # We could return immediately if `width === sidebarVisibleWidth`.
    # Since we expect horizontal dragging, though, the optimization
    # isn't worth its bytes.
    if width < sidebarMinimumWidth
      sidebarStyle.left = "#{ width - sidebarMinimumWidth }px"
      sidebarStyle.width = "#{ sidebarMinimumWidth }px"
    else
      sidebarStyle.left = 0
      sidebarStyle.width = "#{ width }px"

    markupStyle.marginLeft = "#{ width }px"
    sidebarVisibleWidth = width

sendRequest = do ->
  corsNotSupported = ->
    setLocation encode text
    render text, yes

  text = '''
    # I'm sorry, Dave

    Your browser appears not to support
    [cross-origin resource sharing][1].


    [1]: http://en.wikipedia.org/wiki/Cross-Origin_Resource_Sharing
  '''
  (action, params, success) ->
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
      if request.readyState is 4
        if request.status is 200
          json = parseJSON request.responseText
          if json.status_code is 200
            success json.data
          else
            message = json.status_txt.toLowerCase().replace(/_/g, ' ')
            wrapper.className = ''
            wrapper.innerHTML = "bit.ly \u2013 \"#{message}\" :\\"
            shorten.parentNode.removeChild shorten
    try
      request.send()
    catch error
      throw error unless error.message is 'Security violation' # Opera
      do corsNotSupported

sendShortenRequests = (paths) ->
  lastRequests = typeof paths is 'string'
  paths = [paths + queryString(), paths + queryString yes] if lastRequests
  yetToReturn = paths.length

  list = []
  bind = (idx) ->
    (data) ->
      list[idx] = if lastRequests then data else data.hash
      unless yetToReturn -= 1
        if lastRequests
          # Select the document's presentation mode short URL
          # if its canonical URL contains "?mode:presentation".
          setShortUrl list[+presentationModeSpecified()]
        else
          sendShortenRequests 'unpack:' + list

  for path, idx in paths
    sendRequest 'shorten', "longUrl=#{hashifyMe}#{path}", bind idx

setLocation = do ->
  counter = $('counter')
  caution = maxHashLength
  danger = 2083 - "#{hashifyMe}#!/#{queryString yes}".length

  (hash, arg) ->
    {length} = hash
    save = arg is yes
    path = '/' + hash
    path += arg if typeof arg is 'string'

    counter.innerHTML = length
    counter.className =
      if length > danger then 'danger' # too long for old versions of IE
      else if length > caution then 'caution' # too long to send to bit.ly
      else ''
    shorten.style.display =
      if hash is lastSavedDocument then 'none' else 'block'

    if pushStateExists
      history[if save then 'pushState' else 'replaceState'] null, null, path
    else
      path = '/#!' + path
      # Since `location.replace` overwrites the current history entry,
      # saving a location to history is not simply a matter of calling
      # `location.assign`. Instead, we must create a new history entry
      # and immediately overwrite it.

      # Update current history entry.
      location.replace path

      if save
        # Create a new history entry (to save the current one).
        location.hash = '#!/'
        # Update the new history entry (to reinstate the hash).
        location.replace path

setShortUrl = do ->
  textNode = tweet = undefined
  shorturl = document.createElement 'a'
  shorturl.id = 'shorturl'
  wrapper.insertBefore shorturl, qrcode
  (data) ->
    {url} = data
    # Publish "shorturl" event.
    _.pub 'shorturl', url
    shorturl.removeChild textNode if textNode
    shorturl.appendChild textNode = document.createTextNode url
    shorturl.href = url
    qrcode.href = url + '.qrcode'

    # Set default tweet text.
    tweetText = " #{url}"
    tweetText = document.title.substr(0, 140 - tweetText.length) + tweetText

    # Updating the `src` attribute of an `iframe` creates a
    # history entry which interferes with navigation. Instead,
    # we create a new `iframe` as per [Nir Levy's suggestion][1].
    #
    # [1]: http://nirlevy.blogspot.com/2007/09/avoding-browser-history-when-changing.html
    wrapper.removeChild tweet if tweet?.parentNode
    tweet = document.createElement 'iframe'
    tweet.id = 'tweet'
    tweet.frameBorder = 0
    tweet.scrolling = 'no'
    # Twitter insists on shortening _every_ URL passed to it,
    # so we are forced to sneak in bit.ly URLs via the `text`
    # parameter. Additionally, we give the `url` parameter an
    # invalid value: this value is not displayed, but prevents
    # Twitter from including the long URL in the tweet text.
    tweet.src =
      'http://platform.twitter.com/widgets/tweet_button.html' +
      '?count=none&related=hashify&url=foo&text=' +
      encodeURIComponent tweetText
    wrapper.insertBefore tweet, shorturl

    url = data.long_url.substr hashifyMeLen
    unless /^unpack:/.test url
      lastSavedDocument = url
      setLocation url, yes
    wrapper.className = ''

setValue = (text, start, end) ->
  # Firefox and its ilk reset `scrollTop` whenever we assign
  # to `editor.value`. To preserve scroll position we record
  # the offset before assignment and reinstate it afterwards.
  scrollTop = editor.scrollTop
  editor.value = lastEditorValue = text
  editor.scrollTop = scrollTop

  if start?
    editor.focus()
    editor.setSelectionRange start, end
    updateView text

render = do ->
  div = document.createElement 'div'
  stylesheets = []
  (text, setEditorValue) ->
    position = text.length - 1
    charCode = text.charCodeAt position
    if 0xD800 <= charCode < 0xDC00
      # In Chrome, if one attempts to delete a surrogate
      # pair character, only half of the pair is deleted.
      # We strip the orphan to avoid `encodeURIComponent`
      # throwing a `URIError`.
      text = text.substr 0, position
      # Normalize `editor.value`.
      setEditorValue = yes

    while stylesheet = stylesheets.pop()
      document.head.removeChild stylesheet

    re = /^[ ]{0,3}\[stylesheet\]:[ \t]*(\S+)[ \t]*$/gm
    while match = re.exec text
      link = document.createElement 'link'
      link.rel = 'stylesheet'
      link.href = match[1]
      document.head.appendChild stylesheets[stylesheets.length] = link

    Hashify.render text
    div.innerHTML = convert text.match(/^.*$/m)[0]
    document.title = div.textContent or 'Hashify'
    setValue text if setEditorValue
    false

updateView = (value) ->
  render value
  setLocation encode value

Hashify.render or= (text) ->
  markup.innerHTML = convert text
  # Apply syntax highlighting unless instructed otherwise.
  do highlight if prettifyInUse()

## EVENT HANDLERS ##

shortenUrl = ->
  chunk = undefined
  hash = documentHash().replace /[+]/g, '%2B'
  if hash.length <= maxHashLength
    sendShortenRequests hash
  else
    queueChar = ->
      chars.push lastChar
      chunk = chunk.substr 0, idx
      lastChar = chunk.charAt idx -= 1
      chunk

    safeEncode = ->
      # If `lastChar` is the first half of a surrogate pair, drop it
      # from the chunk and queue it for inclusion in the next chunk.
      queueChar() if /[\uD800-\uDBFF]/.test lastChar
      encode(chunk).replace /[+]/g, '%2B'

    maxChunkLength = Math.floor maxHashLength * 3/4
    {value} = editor
    list = []

    while value.length
      # The hash is too long to pass to bit.ly in a single URL; multiple
      # shorter hashes are required. We take the largest chunk of `value`
      # that may have an acceptable hash, then drop characters while the
      # length of the chunk's hash exceeds `maxHashLength`.
      idx = maxChunkLength
      chars = []
      chunk = value.substr 0, idx
      value = value.substr idx
      lastChar = chunk.charAt idx -= 1

      queueChar() while safeEncode().length > maxHashLength

      list.push safeEncode()
      value = chars.reverse().join('') + value

    if list.length > bitlyLimit
      alert "Documents exceeding #{ bitlyLimit * maxChunkLength } " +
            "characters in length cannot be shortened.\n\nThis document " +
            "currently contains #{ editor.value.length } characters."
    else sendShortenRequests list

  wrapper.className = 'loading'
  shorten.style.display = 'none'

shorten.onclick = ->
  do shortenUrl
  false

editor.onkeyup = ->
  # In Chrome, if `editor` has focus, this function is invoked when
  # one hits "enter" in the location bar! Without this check, if one
  # were to type "twitter.com" into the location bar and hit "enter",
  # the ensuing chain of events would result in the current location
  # replacing "twitter.com" in the location bar, and no Twitter. >.<

  # If `editor.value` has changed since last we checked, we go ahead
  # and update the view. If it has _not_ changed, as will be the case
  # when one hits "enter" in the location bar, we needn't do anything.
  unless lastEditorValue is lastEditorValue = @value
    updateView lastEditorValue

document.onkeydown = (event) ->
  event or= window.event
  return if (event.target or event.srcElement) is editor
  return if event.ctrlKey or event.altKey or event.metaKey

  switch event.keyCode
    when 27 # escape
      kbdShortcuts.className = ''
    when 37 # left arrow
      resizeSidebar 0
    when 39 # right arrow
      width = Math.max sidebarMinimumWidth, preferredWidth
      resizeSidebar width if width > sidebarVisibleWidth
    when 191, 0 # "/" or "?" (Firefox reports `keyCode` of `0` for "?")
      kbdShortcuts.className = 'active' if event.shiftKey

document.onclick = ->
  kbdShortcuts.className = ''

editor.ondragenter = -> false

editor.ondragover = -> false

editor.ondrop = (event) ->
  {dataTransfer} = event
  url = dataTransfer.getData 'URL'

  insertImage = (uri) ->
    {value} = editor
    start = editor.selectionStart
    end = editor.selectionEnd
    {files} = dataTransfer

    alt =
      value.substring(start, end) or
      name = files?[0]?.name and name.substr(0, name.lastIndexOf '.') or 'alt'

    setValue(
      "#{ value.substr 0, start }![#{ alt }](#{ uri })#{ value.substr end }"
      pos = start + '!['.length
      pos + alt.length
    )

  insertLink = (uri) ->
    {value} = editor
    start = editor.selectionStart
    end = editor.selectionEnd
    text = value.substring start, end

    setValue(
      "#{ value.substr 0, start }[#{ text }](#{ uri })#{ value.substr end }"
      pos = start + '['.length
      pos + text.length
    )

  insertText = (text) ->
    {value} = editor
    start = editor.selectionStart
    end = editor.selectionEnd

    setValue(
      value.substr(0, start) + text + value.substr(editor.selectionEnd)
      start
      start + text.length
    )

  if url.split('.').pop() in ['gif', 'jpeg', 'jpg', 'png']
    insertImage url
  else if url
    insertLink url
  else
    return unless typeof FileReader is 'function'
    return unless file = dataTransfer.files[0]
    return unless (type = file.type.split('/')[0]) in ['image', 'text']

    reader = new FileReader()
    if type is 'image'
      reader.onload = (event) -> insertImage event.target.result
      reader.readAsDataURL file
    else
      reader.onload = (event) -> insertText event.target.result
      reader.readAsText file
    false

window.onpopstate = ->
  render decode documentHash(), yes

dragger.onselectstart = -> false # prevent text selection

dragger.onmousedown = (event) ->
  windowWidth = window.innerWidth or Infinity
  body.className = 'dragging'
  draggerPosition = (event or window.event).pageX
  dragging = yes

document.onmousemove = (event) ->
  return unless dragging

  x = (event || window.event).pageX
  w = Math.max 0, sidebarVisibleWidth + x - draggerPosition

  # Restrict maximum width to `windowWidth` - 15 (scrollbar width)
  # - 4 (`#dragger` width + borders).
  if w < windowWidth - 18
    resizeSidebar localStorage.w = preferredWidth = w
    draggerPosition = x

document.onmouseup = ->
  return unless dragging
  body.className = ''
  dragging = no

## INITIALIZATION ##

do ->
  mask = $('mask')
  hash = documentHash()
  presentationMode = presentationModeSpecified()
  search = queryString presentationMode

  ready = ->
    if queryContains 'raw:yes'
      _.sub 'shorturl', (url) ->
        encoded = encode "#{ editor.value }\n\n[#{ url }]"
        location = 'data:text/plain;base64,' + encoded
    else
      if presentationMode then resizeSidebar 0
      else
        resizeSidebar preferredWidth if preferredWidth > sidebarMinimumWidth
        setValue editor.value, 0, editor.value.length unless hash
      body.removeChild mask
    do shortenUrl

  # Initialize `#counter`.
  setLocation hash, search

  Hashify.editor editor, no, editor.onkeyup

  if /^[A-Za-z0-9+/=]+$/.test hash
    unless pushStateExists or location.pathname is '/'
      # In browsers which don't provide `history.pushState`
      # we fall back to hashbangs. If `location.hash` is to be
      # the source of truth, `location.pathname` should be "/".
      location.replace '/#!/' + hash + search
    render decode(hash), yes
    do ready
  else if /^unpack:/.test hash
    list = hash.substr(7).split(',')
    # The maximum number of `hash` parameters is 15.
    if list.length <= bitlyLimit
      sendRequest 'expand', "hash=#{ list.join '&hash=' }", (data) ->
        list = data.expand
        for {long_url}, idx in list
          list[idx] = decode long_url.substr hashifyMeLen
        # Canonicalize: btoa('x') + btoa('y') != btoa('xy')
        render list.join(''), yes
        setLocation encode(editor.value), search
        do ready
  else
    do ready
