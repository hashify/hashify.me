window._gaq = [
  ['_setAccount', '<KEY>']
  ['_trackPageview']
]
script = document.createElement 'script'
script.async = true
script.type = 'text/javascript'
script.src = 'http://www.google-analytics.com/ga.js'
document.body.insertBefore script, document.getElementById 'script'
