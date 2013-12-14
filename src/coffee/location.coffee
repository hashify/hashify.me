{addEvent, decode, publish, subscribe} = Hashify.utils

directives = [
  # name,  in longest query
  ['mode:presentation', yes]
  ['raw:yes',            no]
]

class Query
  constructor: (params) ->
    @params = {}
    @params[param] = 1 for param in params

  clone: ->
    new Query @params

  contains: (param) ->
    param of @params

  toString: ->
    params = (name for [name] in directives when @contains name).join(';')
    params and '?' + params

subscribe 'pre:hashchange', (args...) ->
  args unless /^unpack:/.test args[0]

subscribe 'hashchange', (hash, options = {}) ->
  publish 'textchange', text = decode hash
  publish 'save', hash, text if options.save
  path = '/' + hash + (Hashify.location.components().query or '')
  if window.history?.pushState
    method = if options.save then 'pushState' else 'replaceState'
    history[method] null, null, path
  else
    path = '/#!' + path
    # Since `location.replace` overwrites the current history entry,
    # saving a location to history is not simply a matter of calling
    # `location.assign`. Instead, we must create a new history entry
    # and immediately overwrite it.

    # Update current history entry.
    location.replace path

    if options.save
      # Create a new history entry (to save the current one).
      location.hash = '#!/'
      # Update the new history entry (to reinstate the hash).
      location.replace path

components = ->
  {pathname, search, hash} = location
  if match = /^#!\/([^?]*)(\?.*)?$/.exec(hash)
    hash: match[1], query: match[2]
  else
    hash: pathname.substr(1), query: search

addEvent window, 'popstate', ->
  publish 'hashchange', components().hash

longest = new Query (name for [name, include] in directives when include)

Hashify.location =
  components: ->
    {hash, query} = components()
    query = new Query query and query.replace(/^\?/, '').split(';') or []
    {hash, query}
  longestQueryString: "#{longest}"
