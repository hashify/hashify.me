BOWER = node_modules/.bin/bower
COFFEE = node_modules/.bin/coffee
COMPASS = compass compile --no-line-comments


.PHONY: all
all: \
		nginx.conf \
		$(patsubst assets/%,public/%,$(shell find assets -type f)) \
		public/style.css \
		public/concat.js


nginx.conf: nginx.conf.default
	sed 's!<ROOT>!$(abspath $(@D))/public!' $< > $@


public/%: assets/%
	mkdir -p $(@D)
	cp $< $@


public/style.css: \
		bower_components/highlightjs/styles/github.css \
		bower_components/hashify-editor/hashify-editor.css \
		lib/css/hashify.css
	cat $^ > $@

lib/css/hashify.css: src/sass/hashify.sass
	$(COMPASS) --sass-dir $(dir $<) --css-dir $(dir $@)


public/concat.js: \
		node_modules/airwaves/lib/airwaves.js \
		node_modules/Base64/base64.js \
		node_modules/marked/lib/marked.js \
		bower_components/highlightjs/highlight.pack.js \
		bower_components/hashify-editor/hashify-editor.js \
		lib/js/settings.js \
		lib/js/channel.js \
		lib/js/utils.js \
		lib/js/location.js \
		lib/js/document.js \
		lib/js/editor.js \
		lib/js/share.js \
		lib/js/shortcuts.js \
		lib/js/initialize.js
	cat $^ > $@

lib/js/%.js: src/coffee/%.coffee
	mkdir -p $(@D)
	cat $< | $(COFFEE) --compile --stdio > $@


.PHONY: setup
setup:
	npm install
	bin/components | xargs $(BOWER) install


.PHONY: clean
clean:
	rm -rf lib public nginx.conf
