{components} = Hashify.location
{subscribe} = Hashify.utils

# This is a live collection:
nodeList = document.getElementsByTagName 'code'

subscribe 'post:render', ->
  # Apply syntax highlighting unless instructed otherwise.
  return if components().query.contains 'prettify:no'
  node.className = 'prettyprint' for node in nodeList
  do prettyPrint
