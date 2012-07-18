{components} = Hashify.location
{bitlyLimit, maxHashLength, root} = Hashify.settings
{$, addEvent, publish, sendRequest, subscribe} = Hashify.utils

qrcode  = $('qrcode')
shorten = $('shorten')
wrapper = $('wrapper')

lastSavedDocument = undefined

subscribe 'request:error', (data) ->
  message = data.status_txt.toLowerCase().replace(/_/g, ' ')
  wrapper.className = ''
  wrapper.innerHTML = "bitly \u2013 \"#{message}\" :\\"
  shorten.parentNode.removeChild shorten

sendShortenRequests = (paths) ->
  {query} = components()
  if lastRequests = typeof paths is 'string'
    clone = query.clone()
    clone.params['mode:presentation'] = 1
    paths = [paths + query, paths + clone]

  yetToReturn = paths.length
  list = []
  bind = (idx) ->
    (data) ->
      list[idx] = if lastRequests then data else data.hash
      unless yetToReturn -= 1
        if lastRequests
          # Select the document's presentation mode short URL
          # if its canonical URL contains "?mode:presentation".
          setShortUrl list[+query.contains 'mode:presentation']
        else
          sendShortenRequests 'unpack:' + list

  for path, idx in paths
    sendRequest 'shorten', "longUrl=#{root}#{path}", bind idx

textNode = tweet = undefined
shorturl = document.createElement 'a'
shorturl.id = 'shorturl'
wrapper.insertBefore shorturl, qrcode

setShortUrl = (data) ->
  {url} = data
  publish 'shorturl', url
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
  # so we are forced to sneak in bitly URLs via the `text`
  # parameter. Additionally, we give the `url` parameter an
  # invalid value: this value is not displayed, but prevents
  # Twitter from including the long URL in the tweet text.
  tweet.src =
    'http://platform.twitter.com/widgets/tweet_button.html' +
    '?count=none&related=hashify&url=foo&text=' +
    encodeURIComponent tweetText
  wrapper.insertBefore tweet, shorturl
  wrapper.className = ''
  publish 'hashchange', lastSavedDocument = components().hash, save: yes

addEvent shorten, 'click', (event) ->
  (event or window.event).preventDefault()
  publish 'shorten'

subscribe 'shorten', ->
  chunk = lastChar = undefined
  hash = components().hash.replace /[+]/g, '%2B'
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
      Hashify.encode(chunk).replace /[+]/g, '%2B'

    maxChunkLength = Math.floor maxHashLength * 3/4
    value = Hashify.editor.value()
    list = []

    while value.length
      # The hash is too long to pass to bitly in a single URL; multiple
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
      alert """
        Documents exceeding #{ bitlyLimit * maxChunkLength
        } characters in length cannot be shortened.

        This document currently contains #{ Hashify.editor.value().length
        } characters.
      """
    else sendShortenRequests list

  wrapper.className = 'loading'
  shorten.style.display = 'none'

subscribe 'hashchange', (hash) ->
  shorten.style.display =
    if hash is lastSavedDocument then 'none' else 'block'
