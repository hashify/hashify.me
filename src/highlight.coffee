{subscribe} = Hashify.utils

# This is a live collection:
nodeList = document.getElementsByTagName 'code'

subscribe 'post:render', ->
  for node in nodeList when /^lang-/.test node.className
    node.className = node.className.replace 'lang', 'language'
    hljs.highlightBlock node
