(function () {

  var

    $ = function (id) {
      return document.getElementById(id);
    },

    editor = $('markdown'),

    qrcode = $('qrcode'),

    shorten = $('shorten'),

    sidebar = $('sidebar'),

    wrapper = $('wrapper'),

    bitlyLimit = 15,

    hashifyMe = 'http://hashify.me/',

    hashifyMeLen = hashifyMe.length,

    lastSavedDocument,

    maxHashLength = 2048 - hashifyMe.length,

    pushStateExists = window.history && history.pushState,

    returnFalse = function () { return false; },

    convert = new Showdown().convert,

    encode = Hashify.encode,

    decode = Hashify.decode,

    documentHash = function () {
      return location.pathname.substr(1) || location.hash.substr(3);
    },

    // logic borrowed from https://github.com/jquery/jquery
    parseJSON = function (data) {
      if (typeof data !== 'string' || !data) {
        return null;
      }
      data = data.replace(/^\s+|\s+$/g, '');
      if (
        /^[\],:{}\s]*$/
          .test(
            data
              .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
              .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g, ']')
              .replace(/(?:^|:|,)(?:\s*\[)+/g, '')
          )
      )
      return (
        window.JSON && window.JSON.parse?
          window.JSON.parse(data):
          new Function('return ' + data)()
      );
      throw 'SyntaxError';
    },

    sendRequest = (function () {
      var
        text = [
          "# I'm sorry, Dave",
          '',
          'Your browser appears not to support',
          '[cross-origin resource sharing][1].',
          '',
          '',
          '[1]: http://en.wikipedia.org/wiki/Cross-Origin_Resource_Sharing'
        ].join('\n'),
        corsNotSupported = function () {
          setLocation(encode(text));
          render(text, true);
        };

      return function (action, params, success) {
        var
          json,
          request = new XMLHttpRequest();

        try {
          request.open('GET',
            'http://api.bitly.com/v3/' + action + '?login=davidchambers&' +
            'apiKey=R_20d23528ed6381ebb614a997de11c20a&' + params
          );
        } catch (error) {
          if (
            error.code === 1012 || // NS_ERROR_DOM_BAD_URI
            /^Access is denied\.\r\n$/.test(error.message)) {
            corsNotSupported();
            return;
          }
          throw error;
        }
        request.onreadystatechange = function () {
          if (request.readyState === 4) {
            if (request.status === 200) {
              json = parseJSON(request.responseText);
              if (json.status_code === 200) {
                success(json.data);
              } else {
                wrapper.className = '';
                wrapper.innerHTML =
                  'bit.ly – "' + json.status_txt.toLowerCase().replace(/_/g, ' ') + '" :\\';
                shorten.parentNode.removeChild(shorten);
              }
            }
          }
        };
        try {
          request.send();
        } catch (error) {
          if (error.message !== 'Security violation') throw error;
          // Opera
          corsNotSupported();
        }
      };
    }()),

    setLocation = (function () {
      var
        counter = $('counter'),
        caution = maxHashLength,
        danger = 2083 - (hashifyMe + '#!/').length;
      return function (hash, save) {
        var len = hash.length;
        counter.innerHTML = len;
        counter.className =
          len > danger? 'danger': // too long for old versions of IE
          len > caution? 'caution': // too long to send to bit.ly
          '';
        shorten.style.display = hash === lastSavedDocument? 'none': 'block';

        if (pushStateExists) {
          history[save?'pushState':'replaceState'](null, null, '/' + hash);
        } else {
          // Since `location.replace` overwrites the current history entry,
          // saving a location to history is not simply a matter of calling
          // `location.assign`. Instead, we must create a new history entry
          // and immediately overwrite it.

          // update current history entry
          location.replace('/#!/' + hash);

          if (save) {
            // create a new history entry (to save the current one)
            location.hash = '#!/';
            // update the new history entry (to reinstate the hash)
            location.replace('/#!/' + hash);
          }
        }
      };
    }()),

    setShortUrl = (function (shorturl, textNode, tweet) {
      shorturl.id = 'shorturl';
      wrapper.insertBefore(shorturl, qrcode);
      return function (data) {
        var tweetText, url = data.url;
        if (textNode) shorturl.removeChild(textNode);
        shorturl.appendChild(textNode = document.createTextNode(url));
        shorturl.href = url;
        qrcode.href = url + '.qrcode';
        // set default tweet text
        tweetText = ' ' + url;
        tweetText = (
          document.title.substr(0, 140 - tweetText.length) + tweetText
        );
        // Updating the `src` attribute of an `iframe` creates a
        // history entry which interferes with navigation. Instead,
        // we create a new `iframe` as per [Nir Levy's suggestion][1].
        // 
        // [1]: http://nirlevy.blogspot.com/2007/09/avoding-browser-history-when-changing.html

        if (tweet && tweet.parentNode) {
          wrapper.removeChild(tweet);
        }
        tweet = document.createElement('iframe');
        tweet.id = 'tweet';
        tweet.frameBorder = 0;
        tweet.scrolling = 'no';
        // Twitter insists on shortening _every_ URL passed to it,
        // so we are forced to sneak in bit.ly URLs via the `text`
        // parameter. Additionally, we give the `url` parameter an
        // invalid value: this value is not displayed, but prevents
        // Twitter from including the long URL in the tweet text.
        tweet.src = (
          'http://platform.twitter.com/widgets/tweet_button.html' +
          '?count=none&related=hashify&url=foo&text=' +
          encodeURIComponent(tweetText)
        );
        wrapper.insertBefore(tweet, shorturl);

        url = data.long_url.substr(hashifyMeLen);
        if (!/^unpack:/.test(url)) {
          lastSavedDocument = url;
          setLocation(url, true);
        }
        wrapper.className = '';
      };
    }(document.createElement('a'))),

    setValue = function (text) {
      // Firefox and its ilk reset `scrollTop` whenever we assign
      // to `editor.value`. To preserve scroll position we record
      // the offset before assignment and reinstate it afterwards.
      var scrollTop = editor.scrollTop;
      editor.value = text;
      editor.scrollTop = scrollTop;
    },

    render = (function (undef) {
      var
        div = document.createElement('div'),
        markup = $('markup'),
        style = markup.style,
        properties = ['MozTransition', 'OTransition', 'WebkitTransition'],
        property;

      // We define the transition property here rather than in the style
      // sheet to avoid having animation occur during initial rendering.
      while (property = properties.pop()) {
        if (style[property] !== undef) {
          style[property] = sidebar.style[property] = 'all 0.5s ease-out';
        }
      }
      return function (text, setEditorValue) {
        var
          position = text.length - 1,
          charCode = text.charCodeAt(position);
        if (0xD800 <= charCode && charCode < 0xDC00) {
          // In Chrome, if one attempts to delete a surrogate
          // pair character, only half of the pair is deleted.
          // We strip the orphan to avoid `encodeURIComponent`
          // throwing a `URIError`.
          text = text.substr(0, position);
          // normalize `editor.value`
          setEditorValue = true;
        }
        markup.innerHTML = convert(text);
        div.innerHTML = convert(text.match(/^.*$/m)[0]);
        document.title = div.textContent || 'Hashify';
        if (setEditorValue) setValue(text);
        return false;
      };
    }());

  // EVENT HANDLERS //

  function shortenUrl() {
    var hash = documentHash().replace(/[+]/g, '%2B');
    if (hash.length <= maxHashLength) {
      sendRequest(
        'shorten',
        'longUrl=' + hashifyMe + hash,
        setShortUrl
      );
    } else {
      (function () {
        var
          chars, chunk, i, lastChar, list = [],
          maxChunkLength = Math.floor(maxHashLength * 3/4),
          value = editor.value, yetToReturn;

        function queueChar() {
          chars.push(lastChar);
          chunk = chunk.substr(0, i);
          lastChar = chunk.charAt(--i);
          return chunk;
        }

        function safeEncode() {
          // If `lastChar` is the first half of a surrogate pair, drop it
          // from the chunk and queue it for inclusion in the next chunk.
          /[\uD800-\uDBFF]/.test(lastChar) && queueChar();
          return encode(chunk).replace(/[+]/g, '%2B');
        }

        while (value.length) {
          // The hash is too long to pass to bit.ly in a single URL; multiple
          // shorter hashes are required. We take the largest chunk of `value`
          // that may have an acceptable hash, then drop characters while the
          // length of the chunk's hash exceeds `maxHashLength`.
          i = maxChunkLength;
          chars = [];
          chunk = value.substr(0, i);
          value = value.substr(i);
          lastChar = chunk.charAt(--i);

          while (safeEncode().length > maxHashLength) queueChar();

          list.push(safeEncode());
          value = chars.reverse().join('') + value;
        }

        i = yetToReturn = list.length;
        if (yetToReturn > bitlyLimit) {
          alert(
            'Documents exceeding ' + bitlyLimit * maxChunkLength + ' characters in ' +
            'length cannot be shortened.\n\n' +
            'This document currently contains ' + editor.value.length + ' characters.'
          );
        } else {
          while (i--) {
            (function (item, index) {
              sendRequest(
                'shorten',
                'longUrl=' + hashifyMe + item,
                function (data) {
                  list[index] = data.hash;
                  if (!--yetToReturn) {
                    sendRequest(
                      'shorten',
                      'longUrl=' + hashifyMe + 'unpack:' + list.join(','),
                      setShortUrl
                    );
                  }
                }
              );
            }(list[i], i));
          }
        }
      }());
    }
    wrapper.className = 'loading';
    shorten.style.display = 'none';
  }

  shorten.onclick = function () {
    shortenUrl();
    return false;
  };

  // improve discoverability
  editor.onfocus = function () {
    if (!this.value) {
      this.value = '# Title';
      // don't ask me why this is required
      window.setTimeout(function () {
        editor.setSelectionRange(2, 7);
      }, 0);
      // We've changed the editor's contents, so we should
      // update the view. The `onkeyup` handler already does
      // exactly this. The "keyup" event fires when one tabs
      // into the textarea, but not when one clicks into it.
      editor.onkeyup();
    }
  };

  editor.onkeyup = function () {
    render(this.value);
    var hash = encode(this.value);
    setLocation(hash);
  };

  document.onkeydown = function (event) {
    event || (event = window.event);
    if ((event.target || event.srcElement) !== editor) {
      switch (event.keyCode) {
        case 37: // left arrow
          sidebar.className = 'concealed'; break;
        case 39: // right arrow
          sidebar.className = '';
      }
    }
  };

  editor.ondragenter = returnFalse;
  editor.ondragover = returnFalse;
  editor.ondrop = function (event) {
    var
      dataTransfer = event.dataTransfer,
      url = dataTransfer.getData('URL'),
      file, match, reader,
      insertImage = function (uri) {
        var
          value = editor.value,
          start = editor.selectionStart,
          end = editor.selectionEnd,
          alt = value.substring(start, end) || 'alt';

        editor.value =
          value.substr(0, start) +
          '![' + alt + '](' + uri + ')' +
          value.substr(end);
        start += 2; // '!['.length === 2
        editor.focus();
        editor.setSelectionRange(start, start + alt.length);
        editor.onkeyup();
      },
      insertText = function (text) {
        var
          value = editor.value,
          start = editor.selectionStart;

        editor.value =
          value.substr(0, start) + text +
          value.substr(editor.selectionEnd);
        editor.focus();
        editor.setSelectionRange(start, start + text.length);
        editor.onkeyup();
      };

    if (url) {
      // FIXME: `url` does not necessarily identify an _image_.
      insertImage(url);
    } else if (
      // Avert your eyes, Douglas. I'd prefer
      // to avoid three levels of nesting here.
      typeof FileReader === 'function' &&
      (file = dataTransfer.files[0]) &&
      (match = /^(image|text)\//.exec(file.type))) {

      reader = new FileReader();
      if (match[1] === 'image') {
        reader.onload = function (event) {
          insertImage(event.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = function (event) {
          insertText(event.target.result);
        };
        reader.readAsText(file);
      }
      return false;
    }
  };

  window.onpopstate = function () {
    render(decode(documentHash()), true);
  };

  // INITIALIZATION //

  (function (hash) {
    var i, list, mask = $('mask');

    function ready() {
      document.body.removeChild(mask);
      shortenUrl();
    }
    // initialize `#counter`
    setLocation(hash);

    Hashify.editor(
      editor, false, function () { setLocation(encode(this.value)); }
    );

    if (/^[A-Za-z0-9+/=]+$/.test(hash)) {
      // In browsers which don't provide `history.pushState`
      // we fall back to hashbangs. If `location.hash` is to be
      // the source of truth, `location.pathname` should be "/".
      pushStateExists || location.replace('/#!/' + hash);
      render(decode(hash), true);
      ready();
    } else if (/^unpack:/.test(hash)) {
      list = hash.substr(7).split(',');
      // the maximum number of `hash` parameters is 15
      if (list.length <= bitlyLimit) {
        sendRequest(
          'expand',
          'hash=' + list.join('&hash='),
          function (data) {
            list = data.expand;
            i = list.length;
            while (i--) {
              list[i] = decode(list[i].long_url.substr(hashifyMeLen));
            } // canonicalize: btoa('x') + btoa('y') != btoa('xy')
            render(list.join(''), true);
            setLocation(encode(editor.value));
            ready();
          }
        );
      }
    } else {
      ready();
    }
  }(documentHash()));

}());
