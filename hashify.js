(function (document, window, JSON, Math) {

  var

    $ = function (id) {
      return document.getElementById(id);
    },

    body = document.body,

    dragger = $('dragger'),

    editor = $('markdown'),

    kbdShortcuts = $('kbd-shortcuts'),

    markup = $('markup'),

    qrcode = $('qrcode'),

    shorten = $('shorten'),

    sidebar = $('sidebar'),

    wrapper = $('wrapper'),

    bitlyLimit = 15,

    draggerPosition,

    dragging,

    hashifyMe = 'http://hashify.me/',

    hashifyMeLen = hashifyMe.length,

    lastEditorValue,

    lastSavedDocument,

    maxHashLength = 2048 - hashifyMe.length,

    preferredWidth = (function (match) {
      match = /(?:^|; )w=(\d+?)(?:;|$)/.exec(document.cookie);
      return match? +match[1]: -1;
    }()),

    presentationModeSpecifier = '?mode:presentation',

    pushStateExists = window.history && history.pushState,

    returnFalse = function () { return false; },

    sidebarMinimumWidth =
      // From [https://developer.mozilla.org/en/DOM:window.getComputedStyle]:
      // 
      // > Prior to Gecko 2.0 (Firefox 4 / Thunderbird 3.3 / SeaMonkey 2.1),
      // > the `pseudoElt` parameter was required. No other major browser
      // > required this parameter be specified if null. Gecko has been
      // > changed to match the behavior of other browsers.
      parseInt(window.getComputedStyle(sidebar, null).getPropertyValue('width'), 10),

    sidebarVisibleWidth = sidebarMinimumWidth,

    windowWidth,

    convert = new Showdown('abbreviations').convert,

    encode = Hashify.encode,

    decode = function (text) {
      try {
        return Hashify.decode(text);
      } catch (error) {
        if (error instanceof URIError) return '# ' + error;
        else throw error;
      }
    },

    documentComponents = function () {
      var match = /^#!\/([^?]*)(\?.*)?$/.exec(location.hash);
      return match? match: [null, location.pathname.substr(1), location.search];
    },

    documentHash = function () {
      return documentComponents()[1];
    },

    highlight = (function (prettyPrint, nodeList) {
      nodeList = document.getElementsByTagName('code');
      return function () {
        var i = nodeList.length;
        while (i--) nodeList[i].className = 'prettyprint';
        prettyPrint();
      };
    }(prettyPrint)),

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
      ) return JSON && JSON.parse? JSON.parse(data): new Function('return ' + data)();
      throw new SyntaxError('Invalid JSON');
    },

    resizeSidebar = (function () {
      var
        px = 'px',
        markupStyle = markup.style,
        sidebarStyle = sidebar.style;

      return function (width) {
        // We could return immediately if `width === sidebarVisibleWidth`.
        // Since we expect horizontal dragging, though, the optimization
        // isn't worth its bytes.
        if (width < sidebarMinimumWidth) {
          sidebarStyle.left = width - sidebarMinimumWidth + px;
          sidebarStyle.width = sidebarMinimumWidth + px;
        } else {
          sidebarStyle.left = 0;
          sidebarStyle.width = width + px;
        }
        markupStyle.marginLeft = width + px;
        sidebarVisibleWidth = width;
      };
    }()),

    sendRequest = (function (corsNotSupported, text) {
      corsNotSupported = function () {
        setLocation(encode(text));
        render(text, true);
      };
      text = [
        "# I'm sorry, Dave",
        '',
        'Your browser appears not to support',
        '[cross-origin resource sharing][1].',
        '',
        '',
        '[1]: http://en.wikipedia.org/wiki/Cross-Origin_Resource_Sharing'
      ].join('\n');

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

    sendShortenRequests = function (arg) {
      var
        pms = presentationModeSpecifier,
        lastRequests = typeof arg === 'string',
        paths = lastRequests? [arg, arg + pms]: arg,
        yetToReturn = paths.length,
        i = yetToReturn,
        list = [],
        bind = function (index) {
          return function (data) {
            list[index] = lastRequests? data: data.hash;
            if (!--yetToReturn) {
              lastRequests?
                // Select the document's presentation mode short URL
                // if its canonical URL contains "?mode:presentation".
                setShortUrl(list[+(documentComponents()[2] === pms)]):
                sendShortenRequests('unpack:' + list.join(','));
            }
          };
        };

      while (i--) {
        sendRequest('shorten', 'longUrl=' + hashifyMe + paths[i], bind(i));
      }
    },

    setLocation = (function () {
      var
        counter = $('counter'),
        caution = maxHashLength,
        danger = 2083 - (hashifyMe + '#!/' + presentationModeSpecifier).length;

      return function (hash, arg) {
        var
          len = hash.length,
          path = '/' + hash,
          save = arg === true;

        if (typeof arg === 'string') path += arg;

        counter.innerHTML = len;
        counter.className =
          len > danger? 'danger': // too long for old versions of IE
          len > caution? 'caution': // too long to send to bit.ly
          '';
        shorten.style.display = hash === lastSavedDocument? 'none': 'block';

        if (pushStateExists) {
          history[save?'pushState':'replaceState'](null, null, path);
        } else {
          path = '/#!' + path;
          // Since `location.replace` overwrites the current history entry,
          // saving a location to history is not simply a matter of calling
          // `location.assign`. Instead, we must create a new history entry
          // and immediately overwrite it.

          // update current history entry
          location.replace(path);

          if (save) {
            // create a new history entry (to save the current one)
            location.hash = '#!/';
            // update the new history entry (to reinstate the hash)
            location.replace(path);
          }
        }
      };
    }()),

    setShortUrl = (function (shorturl, textNode, tweet) {
      shorturl = document.createElement('a');
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
    }()),

    setValue = function (text, start, end) {
      // Firefox and its ilk reset `scrollTop` whenever we assign
      // to `editor.value`. To preserve scroll position we record
      // the offset before assignment and reinstate it afterwards.
      var scrollTop = editor.scrollTop;
      editor.value = lastEditorValue = text;
      editor.scrollTop = scrollTop;

      if (start != null) {
        editor.focus();
        editor.setSelectionRange(start, end);
        updateView(text);
      }
    },

    render = (function (div) {
      div = document.createElement('div');
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
        highlight();
        return false;
      };
    }()),

    updateView = function (value) {
      render(value);
      setLocation(encode(value));
    };

  // EVENT HANDLERS //

  function shortenUrl() {
    var
      chars, chunk, i, lastChar, list,
      maxChunkLength, queueChar, safeEncode, value,
      hash = documentHash().replace(/[+]/g, '%2B');

    if (hash.length <= maxHashLength) {
      sendShortenRequests(hash);
    } else {
      queueChar = function () {
        chars.push(lastChar);
        chunk = chunk.substr(0, i);
        lastChar = chunk.charAt(--i);
        return chunk;
      };
      safeEncode = function () {
        // If `lastChar` is the first half of a surrogate pair, drop it
        // from the chunk and queue it for inclusion in the next chunk.
        /[\uD800-\uDBFF]/.test(lastChar) && queueChar();
        return encode(chunk).replace(/[+]/g, '%2B');
      };
      maxChunkLength = Math.floor(maxHashLength * 3/4);
      value = editor.value;
      list = [];

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

      if (list.length > bitlyLimit) {
        alert(
          'Documents exceeding ' + bitlyLimit * maxChunkLength + ' characters in ' +
          'length cannot be shortened.\n\n' +
          'This document currently contains ' + editor.value.length + ' characters.'
        );
      } else {
        sendShortenRequests(list);
      }
    }
    wrapper.className = 'loading';
    shorten.style.display = 'none';
  }

  shorten.onclick = function () {
    shortenUrl();
    return false;
  };

  editor.onkeyup = function () {
    // In Chrome, if `editor` has focus, this function is invoked when
    // one hits "enter" in the location bar! Without this check, if one
    // were to type "twitter.com" into the location bar and hit "enter",
    // the ensuing chain of events would result in the current location
    // replacing "twitter.com" in the location bar, and no Twitter. >.<

    // If `editor.value` has changed since last we checked, we go ahead
    // and update the view. If it has _not_ changed, as will be the case
    // when one hits "enter" in the location bar, we needn't do anything.
    if (lastEditorValue !== (lastEditorValue = this.value)) {
      updateView(lastEditorValue);
    }
  };

  document.onkeydown = function (event) {
    event || (event = window.event);
    if ((event.target || event.srcElement) !== editor) {
      switch (event.keyCode) {
        case 27: // escape
          kbdShortcuts.className = '';
          break;
        case 37: // left arrow
          resizeSidebar(0);
          break;
        case 39: // right arrow
          var width = Math.max(sidebarMinimumWidth, preferredWidth);
          if (width > sidebarVisibleWidth) resizeSidebar(width);
          break;
        case 191: // "/" or "?"
        case 0:  // Firefox reports `keyCode` of `0` for "?"
          if (event.shiftKey) kbdShortcuts.className = 'active';
          break;
      }
    }
  };

  document.onclick = function () {
    kbdShortcuts.className = '';
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

        value =
          value.substr(0, start) +
          '![' + alt + '](' + uri + ')' +
          value.substr(end);

        setValue(value, start += 2, start + alt.length); // '!['.length === 2
      },
      insertText = function (text) {
        var
          value = editor.value,
          start = editor.selectionStart;

        value =
          value.substr(0, start) + text +
          value.substr(editor.selectionEnd);

        setValue(value, start, start + text.length);
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

  dragger.onselectstart = returnFalse; // prevent text selection

  dragger.onmousedown = function (event) {
    windowWidth = window.innerWidth || Infinity;
    body.className = 'dragging';
    draggerPosition = (event || window.event).pageX;
    dragging = true;
  };

  document.onmousemove = function (event) {
    if (!dragging) return;
    var
      x = (event || window.event).pageX,
      w = Math.max(0, sidebarVisibleWidth + x - draggerPosition);

    // Restrict maximum width to `windowWidth` - 15 (scrollbar width)
    // - 4 (`#dragger` width + borders).
    if (w < windowWidth - 18) {
      resizeSidebar(preferredWidth = w);
      document.cookie =
        'w=' + w + '; expires=Fri, 01 Feb 3456 07:08:09 UTC; path=/';
      draggerPosition = x;
    }
  };

  document.onmouseup = function () {
    if (!dragging) return;
    body.className = '';
    dragging = false;
  };

  // INITIALIZATION //

  (function () {
    var
      list,
      mask = $('mask'),
      components = documentComponents(),
      hash = components[1],
      search = components[2],
      presentationMode = search === presentationModeSpecifier;

    function ready() {
      if (presentationMode) {
        resizeSidebar(0);
      } else {
        if (preferredWidth > sidebarMinimumWidth) {
          resizeSidebar(preferredWidth);
        }
        if (!editor.value) setValue('# Title', 2, 7);
      }
      body.removeChild(mask);
      shortenUrl();
    }
    // initialize `#counter`
    setLocation(hash, search);

    Hashify.editor(editor, false, editor.onkeyup);

    if (/^[A-Za-z0-9+/=]+$/.test(hash)) {
      if (!pushStateExists && location.pathname !== '/') {
        // In browsers which don't provide `history.pushState`
        // we fall back to hashbangs. If `location.hash` is to be
        // the source of truth, `location.pathname` should be "/".
        location.replace('/#!/' + hash + search);
      }
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
            var i = list.length;
            while (i--) {
              list[i] = decode(list[i].long_url.substr(hashifyMeLen));
            } // canonicalize: btoa('x') + btoa('y') != btoa('xy')
            render(list.join(''), true);
            setLocation(encode(editor.value), search);
            ready();
          }
        );
      }
    } else {
      ready();
    }
  }());

}(document, window, window.JSON, Math));
