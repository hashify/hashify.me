(function () {

  var

    $ = function (id) {
      return document.getElementById(id);
    },

    _ = function (text) {
      return text.replace(/✪/g, '☺');
    },

    ____ = '    ',

    editor = $('markdown'),

    shorten = $('shorten'),

    tweet = $('tweet'),

    wrapper = $('wrapper'),

    bitlyLimit = 15,

    domain = 'hashify.me',

    debug = location.hostname !== domain,

    hashifyMe = 'http://' + domain + '/',

    lastSavedDocument,

    maxHashLength = 2048 - hashifyMe.length,

    pushStateExists = window.history && history.pushState,

    convert = new Showdown().convert,

    encode = function (text) {
      return btoa(unescape(encodeURIComponent(text)));
    },

    decode = function (text) {
      return decodeURIComponent(escape(atob(text)));
    },

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

    resolve = function (reSelection, reBefore, reAfter, open, close) {
      var
        openLen = open.length,
        selection = new Selection(),
        before = selection.before,
        after = selection.after,
        start = before.length,
        text = selection.toString(),
        len = text.length;

      close || (close = open);

      render(
        reSelection.test(text)?
          (len -= openLen + close.length, before + text.substr(openLen, len) + after):
          reAfter.test(after) && reBefore.test(before)?
            (start -= openLen, before.substr(0, start) + text + after.substr(close.length)):
            (start += openLen, before + open + text + close + after),
        true
      );
      editor.setSelectionRange(start, start + len);
      editor.focus();
      return false;
    },

    sendRequest = function (action, params, success) {
      var
        text,
        request = new XMLHttpRequest();

      try {
        request.open('GET',
          'http://api.bitly.com/v3/' + action + '?login=davidchambers&' +
          'apiKey=R_20d23528ed6381ebb614a997de11c20a&' + params
        );
      } catch (error) {
        if (error.code !== 1012) throw error;
        // NS_ERROR_DOM_BAD_URI
        text = [
          "# I'm sorry, Dave",
          '',
          'Your browser appears not to support',
          '[cross-origin resource sharing][1].',
          '',
          '_Click "back" then reload the page to restore your document._',
          '',
          '',
          '[1]: http://en.wikipedia.org/wiki/Cross-Origin_Resource_Sharing'
        ].join('\n');
        // Save the current location to history, enabling the user to
        // restore the document by going back then reloading the page.
        setLocation(documentHash(), true);
        setLocation(encode(text));
        render(text, true);
        return;
      }
      request.onreadystatechange = function () {
        if (request.readyState === 4) {
          if (request.status === 200) {
            success.call(null, parseJSON(request.responseText).data);
          }
        }
      };
      request.send();
    },

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

    setShortUrl = (function (shorturl, textNode) {
      shorturl.id = 'shorturl';
      wrapper.appendChild(shorturl);
      return function (data) {
        var tweetText;
        if (textNode) shorturl.removeChild(textNode);
        shorturl.appendChild(
          textNode = document.createTextNode(shorturl.href = data.url)
        );
        // set default tweet text
        tweetText = ' ' + data.url;
        tweetText = (
          document.title.substr(0, 140 - tweetText.length) + tweetText
        );
        tweet.src = (
          tweet.src.replace(
            /text=.*/,
            'text=' + encodeURIComponent(tweetText)
          )
        );
        setLocation(lastSavedDocument = data.long_url.substr(18), true);
        wrapper.className = '';
      }
    }(document.createElement('a'))),

    render = (function () {
      var
        div = document.createElement('div'),
        markup = $('markup');
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
        }
        markup.innerHTML = convert(text);
        div.innerHTML = convert(text.match(/^.*$/m)[0]);
        document.title = div.textContent || 'Hashify';
        if (setEditorValue) editor.value = text;
        return false;
      };
    }());

  function Selection(re, prefix, prefix0) {
    var
      value = (this.value = editor.value),
      start = (this.start = editor.selectionStart),
      end   = (this.end   = editor.selectionEnd);

    this.textRegex   = new RegExp('^' + re);
    this.beforeRegex = new RegExp('^' + re + '$', 'm');

    this.prefix_ = prefix;
    this.prefix0 = prefix0 || prefix;

    this.before = value.substr(0, start);
    this.after = value.substr(end);
    this.lines = value.substring(start, end).split(/\r?\n/g);
  }

  Selection.prototype.each = function (iterator) {
    var
      lines = this.lines,
      i = lines.length;

    while (i--) {
      iterator.call(this, lines[i], i, lines);
    }
    return this;
  };

  Selection.prototype.isInlineCode = function () {
    var
      match = (
        convert(
          _(this.before + this.toString()) + '✪` `` ' + _(this.after)
        ).match(/<code>[^<]*✪(`?)<\/code>/)
      );
    return match && match[1] + '`';
  };

  Selection.prototype.wrap = function (chr) {
    var
      text = this.toString(),
      len = text.length,
      position = this.before.length + 1,
      value = editor.value = (
        function () {
          var re = new RegExp('^([' + chr + ']{0,2}).*\\1$');
          switch (re.exec(text)[1].length) {
            case 0:
              re = new RegExp('([' + chr + ']{0,2})✪\\1');
              switch (re.exec(_(this.before) + '✪' + _(this.after))[1].length) {
                case 0:
                case 1: return [this.before, text, this.after].join(chr);
                case 2: return this.before.substr(0, position -= 3) + text + this.after.substr(2);
              }
            case 1:
              len -= 2; position += 1;
              return [this.before, text, this.after].join(chr);
            case 2:
              len -= 4; position -= 1;
              return this.before + text.substr(2, len) + this.after;
          }
        }.call(this)
      );
    editor.setSelectionRange(position, position + len);
    return value;
  };

  Selection.prototype.blockify = function () {
    var
      b = this.before,
      a = this.after;

    /((\r?\n){2}|^\s*)$/.test(b) || (this.before = b.replace(/\s*$/, '\n\n'));
    /^((\r?\n){2}|\s*$)/.test(a) || (this.after  = a.replace(/^\s*/, '\n\n'));

    return this;
  };

  Selection.prototype.prefix = function () {
    return this.each(function (line, index, lines) {
      lines[index] = (index ? this.prefix_ : this.prefix0) + line;
    });
  };

  Selection.prototype.unprefix = function () {
    return this.each(function (line, index, lines) {
      lines[index] = line.replace(index ? this.prefix_ : this.prefix0, '');
    });
  };

  Selection.prototype.render = function () {
    var
      matches = this.beforeRegex.exec(this.before),
      offset = 0, start, text, value;

    if (matches) {
      this.before = this.before.replace(this.beforeRegex, '');
      this.unprefix();
    }
    else if (matches = this.textRegex.exec(this.lines[0])) {
      this.unprefix();
    }
    else {
      this.blockify().prefix();
      offset = this.prefix0.length;
    }
    start = this.before.length;
    text = this.toString();
    editor.value = value = this.before + text + this.after;
    editor.setSelectionRange(start + offset, start + text.length);
    editor.focus();
    return value;
  };

  Selection.prototype.toString = function () {
    return this.lines.join('\n');
  };

  // EVENT HANDLERS //

  shorten.onclick = function (event) {
    var
      commandArray = ['_trackEvent', 'shorten', editor.value.length],
      hash = documentHash().replace(/[+]/g, '%2B');

    debug?
      console.log(commandArray):
      _gaq.push(commandArray);

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

          list.push(chunk);
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
                'longUrl=' + hashifyMe + encode(item),
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
    (event || window.event).preventDefault();
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

  editor.onkeypress = function (event) {
    event || (event = window.event);
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var
      chr = String.fromCharCode(event.charCode),
      selection = new Selection(),
      before = selection.before,
      after = selection.after,
      text = selection.toString(),
      position = before.length + 1;

    if (/[`_*]/.test(chr)) {
      if (text) return render(selection.wrap(chr));
      switch (chr) {
        case '`':
          if (
            text = (
              (text = selection.isInlineCode())?
                /^`/.test(after)?
                  null:
                  /^\w/.test(after)?'`':text:
                /^`/.test(after)?
                  /`$/.test(before)?
                    null:
                    /^(``)*(?!`)/.test(after)?'``':'`':
                  /^\w/.test(after)?'`':'``'
            )
          ) render(before + text + after, true);
          break;
        case '_':
          if (
            text = (
              (/^__/.test(after) || /^_/.test(after) && /_$/.test(before))?
                null:
                /__$/.test(before)?
                  '_':
                  /(^|[^_])_[^_]+\b$/.test(before)?
                    /^_/.test(after)?'':'_':
                    /^\w/.test(after)?'_':'__'
            )
          ) render(before + text + after, true);
          break;
        case '*':
          return;
      }
      editor.setSelectionRange(position, position);
      event.preventDefault();
    }
  };

  editor.onkeyup = function () {
    // normalize `editor.value`
    render(this.value, true);
    var hash = encode(this.value);
    shorten.style.display = hash === lastSavedDocument ? 'none' : 'block';
    setLocation(hash);
  };

  $('strong').onclick = function () {
    return resolve(
      /^(__|\*\*).*\1$/,
      /(__|\*\*)$/, /^(__|\*\*)/,
      '**'
    );
  };

  $('em').onclick = function () {
    var
      selection = new Selection(),
      before = selection.before,
      after = selection.after,
      start = before.length,
      text = selection.toString(),
      len = text.length;

    render(
      /^([_*]).*\1$/.test(text)?
        (len -= 2, before + text.substr(1, len) + after):
        /([_*])✪\1/.test(_(before) + '✪' + _(after))?
          (--start, before.substr(0, start) + text + after.substr(1)):
          (++start, [before, text, after].join('_')),
      true
    );
    editor.setSelectionRange(start, start + len);
    editor.focus();
    return false;
  };

  $('img').onclick = function () {
    return resolve(
      /^!\[.*\]\(http:\/\/\)$/,
      /!\[$/, /^\]\(http:\/\/\)/,
      '![', '](http://)'
    );
  };

  $('a').onclick = function () {
    return resolve(
      /^\[.*\]\(http:\/\/\)$/,
      /\[$/, /^\]\(http:\/\/\)/,
      '[', '](http://)'
    );
  };

  $('blockquote').onclick = function () {
    return render(new Selection(' {0,3}>[ \\t]*', '> ').render());
  };

  $('pre-code').onclick = function () {
    return render(new Selection('( {4}|\t)', ____).render());
  };

  $('ol').onclick = function () {
    return render(new Selection(' {0,3}\\d+[.][ \\t]*', ____, ' 1. ').render());
  };

  $('ul').onclick = function () {
    return render(new Selection(' {0,3}[*+-][ \\t]*', ____, '  - ').render());
  };

  $('h1').onclick = function () {
    var
      matches, offset = 0, start, text,
      selection = new Selection('(#{1,6})[ \\t]*', '# ');

    selection.lines = [selection.lines.join(' ').replace(/\s+/g, ' ')];

    if (matches = selection.beforeRegex.exec(selection.before)) {
      selection.before =
        selection.before.replace(
          selection.beforeRegex, matches[1].length < 4 ? '$1# ' : '');
    }
    else if (matches = selection.textRegex.exec(selection.lines[0])) {
      selection.lines[0] =
        selection.lines[0].replace(
          selection.textRegex, matches[1].length < 4 ? '$1# ' : '');
    }
    else {
      selection.blockify().prefix();
      offset = selection.prefix0.length;
    }
    start = selection.before.length;
    text = selection.toString();
    render(selection.before + text + selection.after, true);
    editor.setSelectionRange(start + offset, start + text.length);
    editor.focus();
    return false;
  };

  $('hr').onclick = function () {
    var
      selection = new Selection().blockify(),
      before = selection.before,
      start = before.length,
      text = selection.toString() === '- - -' ? '' : '- - -';

    render(before + text + selection.after, true);
    editor.setSelectionRange(start, start + text.length);
    editor.focus();
    return false;
  };

  window.onpopstate = function () {
    render(decode(documentHash()), true);
  };

  // INITIALIZATION //

  (function (hash) {
    var i, list;
    // initialize `#counter`
    setLocation(hash);

    // Twitter insists on shortening _every_ URL passed to it,
    // so we are forced to sneak in bit.ly URLs via the `text`
    // parameter. Additionally, we give the `url` parameter an
    // invalid value: this value is not displayed, but prevents
    // Twitter from including the long URL in the tweet text.
    tweet.src = (
      'http://platform.twitter.com/widgets/tweet_button.html' +
      '?count=none&related=hashify&url=foo&text='
    );
    if (/^[A-Za-z0-9+/=]+$/.test(hash)) {
      // In browsers which don't provide `history.pushState`
      // we fall back to hashbangs. If `location.hash` is to be
      // the source of truth, `location.pathname` should be "/".
      pushStateExists || location.replace('/#!/' + hash);
      render(decode(hash), true);
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
              list[i] = decode(list[i].long_url.substr(18));
            } // canonicalize: btoa('x') + btoa('y') != btoa('xy')
            render(list.join(''), true);
            setLocation(encode(editor.value));
          }
        );
      }
    }
  }(documentHash()));

}());
