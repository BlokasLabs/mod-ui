function objectEmpty(obj) {
    for (var i in obj) return false
    return true
}

JqueryClass('patchstorageBox', {
    init: function (options) {
        var self = $(this)

        options = $.extend({
            resultCanvas: self.find('.js-patchstorage'),
            removePluginBundles: function (bundles, callback) {
                callback({})
            },
            info: null,
            isMainWindow: true,
            windowName: "Patchstorage",
            pluginsData: {},
            pluginLocalChecked: false,
            pluginsLocalChecked: false,
            pluginCloudChecked: false,
            pluginsCloudChecked: false,
            xhrs: []
        }, options)

        self.data(options)

        var searchbox = self.find('input[type=search]')

        // make sure searchbox is empty on init
        searchbox.val("")

        self.data('searchbox', searchbox)
        searchbox.cleanableInput()

        self.data('category', null)
        self.patchstorageBox('setCategory', "All")

        var lastKeyTimeout = null
        searchbox.keydown(function (e) {
            if (e.keyCode == 13) { // detect enter
                if (lastKeyTimeout != null) {
                    clearTimeout(lastKeyTimeout)
                    lastKeyTimeout = null
                }
                self.patchstorageBox('search')
                return false
            }
            else if (e.keyCode == 8 || e.keyCode == 46) { // detect delete and backspace
                if (lastKeyTimeout != null) {
                    clearTimeout(lastKeyTimeout)
                }
                lastKeyTimeout = setTimeout(function () {
                    self.patchstorageBox('search')
                }, 400);
            }
        })
        searchbox.keypress(function (e) { // keypress won't detect delete and backspace but will only allow inputable keys
            if (e.which == 13)
                return
            if (lastKeyTimeout != null) {
                clearTimeout(lastKeyTimeout)
            }
            lastKeyTimeout = setTimeout(function () {
                self.patchstorageBox('search')
            }, 400);
        })
        searchbox.on('paste', function (e) {
            if (lastKeyTimeout != null) {
                clearTimeout(lastKeyTimeout)
            }
            lastKeyTimeout = setTimeout(function () {
                self.patchstorageBox('search')
            }, 400);
        })

        self.find('input:checkbox[name=installed]').click(function (e) {
            self.find('input:checkbox[name=non-installed]').prop('checked', false)
            self.find('input:checkbox[name=not-available]').prop('checked', false)
            self.patchstorageBox('search')
        })
        self.find('input:checkbox[name=non-installed]').click(function (e) {
            self.find('input:checkbox[name=installed]').prop('checked', false)
            self.find('input:checkbox[name=not-available]').prop('checked', false)
            self.patchstorageBox('search')
        })
        self.find('input:checkbox[name=not-available]').click(function (e) {
            self.find('input:checkbox[name=installed]').prop('checked', false)
            self.find('input:checkbox[name=non-installed]').prop('checked', false)
            self.patchstorageBox('search')
        })

        self.find('#patchstorage_update_all').hide()

        self.find('ul.categories li').click(function () {
            var category = $(this).attr('id').replace(/^patchstorage-tab-/, '')
            self.patchstorageBox('setCategory', category)
        })

        options.open = function () {
            self.patchstorageBox('search')
            return false
        }

        self.window(options)

        return self
    },

    setCategory: function (category) {
        var self = $(this)

        self.find('ul.categories li').removeClass('selected')
        self.find('.plugins-wrapper').hide()
        self.find('#patchstorage-tab-' + category).addClass('selected')
        self.find('#patch-content-' + category).show().css('display', 'inline-block')
        self.data('category', category)

    },

    cleanResults: function () {
        var self = $(this)
        self.find('.plugins-wrapper').html('')
        self.find('ul.categories li').each(function () {
            var content = $(this).html().split(/\s/)
            if (content.length >= 2 && content[1] == "Utility") {
                $(this).html(content[0] + " Utility")
            } else {
                $(this).html(content[0])
            }
        });
    },

    // TODO: merge with mergePluginData?
    transformPatch: function (patch) {
        patch.psid = patch.id.toString()
        patch.uri = patch.id.toString()
        patch.ps_cloud_version = (patch.revision) ? patch.revision : "0.0" // ensure we have a revision
        patch.name = unescape(patch.title)
        patch.label = unescape(patch.title)
        patch.comment = (patch.content) ? unescape(patch.content) : unescape(patch.excerpt)
        patch.thumbnail_href = patch.artwork.thumbnail_url
        patch.screenshot_href = patch.artwork.url

        var tags = []

        patch.categories.forEach(function(item) {
            var name = item.slug.replace('-', '').toLowerCase()
            if (!tags.includes(name)) tags.push(name)
        })

        patch.tags.forEach(function(item) {
            var name = item.slug.replace('-', '').toLowerCase()
            if (!tags.includes(name)) tags.push(name)
        })

        var getCategoryFromTags = function (tags) {
            var map = {
                'delay': 'Delay',
                'distortion': 'Distortion',
                'dynamics': 'Dynamics',
                'filter': 'Filter',
                'generator': 'Generator',
                'modulator': 'Modulator',
                'reverb': 'Reverb',
                'simulator': 'Simulator',
                'spatial': 'Spatial',
                'spectral': 'Spectral',
                'controlvoltage': 'ControlVoltage',
                'midi': 'MIDI',
                'utility': 'Utility'
            }

            for (var k in map) {
                if (tags.includes(k)) {
                    return [map[k],]
                }
            }

            return ['Other',]
        }

        patch.category = getCategoryFromTags(tags)
        patch.tags = tags.join(', ')

        delete patch.id
        delete patch.artwork
        delete patch.content
        delete patch.categories
        delete patch.code
        delete patch.comment_count
        delete patch.created_at
        delete patch.custom_license_text
        delete patch.like_count
        delete patch.preview_url
        delete patch.self
        delete patch.title
        delete patch.updated_at
        delete patch.source_code_url
        delete patch.slug
        delete patch.platform
        delete patch.excerpt

        return patch
    },

    transformPatches: function (patches) {
        var self = $(this)
        patches.map((patch, i) => {
            patch = self.patchstorageBox('transformPatch', patch)
        })
        return patches
    },

    // TODO: single vs list flag needed?
    mergePluginData: function (cloud, local) {
        if (!cloud && !local) {
            return {}
        }

        var self = $(this)
        var cplugin = $.extend(true, {}, cloud)
        var lplugin = $.extend(true, {}, local)
        var existsCloud = !objectEmpty(cplugin)
        var existsLocal = !objectEmpty(lplugin)
        var plugin = {}

        // var schema_full = {
        //     author: {
        //         name: null, // str
        //         homepage: null, // url
        //         email: null // mailto:email format
        //     },
        //     binary: null, // *.so file path
        //     brand: null, // used in list view as author
        //     buildEnvironment: null, // investigate
        //     builder: null, // investigate
        //     bundles: null, // [str,] used for remove, etc.
        //     category: null, // [str,]
        //     comment: null, // main info str field
        //     gui: null, // {} modgui related object
        //     label: null, // short name used in UI
        //     license: null, // license URL
        //     licensed: null, // int bool
        //     microVersion: null, // int
        //     minorVersion: null, // int
        //     name: null, // longer name
        //     parameters: null, // []
        //     ports: null, // {} ports object
        //     presets: null, // [] presets list
        //     release: null, // investigate (int bool?)
        //     stability: null, // str (e.g. testing)
        //     uri: null, // lv2 unique id
        //     valid: null, // bool
        //     version: null, // str version number
        // }

        plugin.uri = lplugin.uri || cplugin.uri
        plugin.link = cplugin.url
        plugin.label = lplugin.label || cplugin.label
        plugin.name = cplugin.name || lplugin.name 
        plugin.comment = cplugin.comment || lplugin.comment 
        plugin.category = (lplugin.category && lplugin.category.length) ? lplugin.category : (cplugin.category && cplugin.category.length) ? cplugin.category : []
        plugin.tags = cplugin.tags
        plugin.author = lplugin.author
        plugin.psid = lplugin.psid || cplugin.psid
        plugin.brand = lplugin.brand
        plugin.download_count = cplugin.download_count
        plugin.uploader = cplugin.uploader
        plugin.ps_local_version = lplugin.ps_local_version
        plugin.ps_cloud_version = cplugin.ps_cloud_version
        
        if (existsLocal) {
            plugin.plugin_version = [lplugin.builder || 0, lplugin.minorVersion, lplugin.microVersion, lplugin.release]
            plugin.status = 'installed'

            if (lplugin.bundles) {
                plugin.bundles = lplugin.bundles
            }

            // prefer to show installed modgui screenshot for better recognition
            if (lplugin.gui) {
                var uri = escape(lplugin.uri)
                var ver = [lplugin.builder, lplugin.microVersion, lplugin.minorVersion, lplugin.release].join('_')

                plugin.screenshot_href = "/effect/image/screenshot.png?uri=" + uri + "&v=" + ver
                plugin.thumbnail_href = "/effect/image/thumbnail.png?uri=" + uri + "&v=" + ver
            }

            if (lplugin.ports) {
                plugin.ports = lplugin.ports
            }

            if (!existsCloud && lplugin.psid) {
                plugin.status = 'unavailable'
            }
        }

        if (existsCloud) {
            plugin.uploader = cplugin.author
            plugin.files = cplugin.files
            plugin.state = cplugin.state.slug
            plugin.brand = cplugin.author.slug
        }

        // no media - no problem, take from cloud or default img
        if (!plugin.screenshot_href) {
            plugin.screenshot_href = (cplugin && cplugin.screenshot_href) ? cplugin.screenshot_href : "/resources/pedals/default-screenshot.png"
        }
        if (!plugin.thumbnail_href) {
            plugin.thumbnail_href = (cplugin && cplugin.thumbnail_href) ? cplugin.thumbnail_href : "/resources/pedals/default-thumbnail.png"
        }

        if (plugin.ps_local_version && plugin.ps_cloud_version && plugin.ps_cloud_version != plugin.ps_local_version) {
            plugin.status = 'outdated'
        }

        if (plugin.category && plugin.category.length == 2 && plugin.category[0] == 'Utility' && plugin.category[1] == 'MIDI') {
            plugin.category = ['MIDI',]
        }

        self.patchstorageBox('synchronizePluginData', plugin)
        return plugin

    },

    getCloudPlugins: function (query, store, callback) {
        var self = $(this)
        var base = PATCHSTORAGE_API_URL
        var platform_id = PATCHSTORAGE_PLATFORM_ID
        var target_id = PATCHSTORAGE_TARGET_ID
        var url = `${base}?per_page=100&platforms=${platform_id}&targets=${target_id}`
        var page = 1

        // ensure store cloud is ready
        store.cloud = {}

        function getNextPage() {
            var xhr = $.ajax({
                url: url + `&page=${page}`,
                method: 'GET',
                async: true,
                cache: false,
                dataType: 'json',
                success: function (data, status, xhr) {
                    if (!data || data.length < 1) {
                        self.data('pluginsCloudChecked', true)
                        callback()
                    }

                    var pages = xhr.getResponseHeader('x-wp-totalpages')
                    var transformed = self.patchstorageBox('transformPatches', data)
                    for (var i in transformed) {
                        store.cloud[transformed[i].uri] = transformed[i]
                    }

                    if (pages && pages > page) {
                        page++
                        getNextPage()
                    } else {
                        self.data('pluginsCloudChecked', true)
                        callback()
                    }
                },
                error: function (xhr, status) {
                    if (status == 'abort') return
                    new Notification('error', "Connection to Patchstorage failed!", 5000)
                    store.cloud = {}
                    self.data('pluginsCloudChecked', true)
                    callback()
                }
            });
            self.data('xhrs').push(xhr)
        }

        getNextPage()
    },

    getLocalPlugins: function (query, store, callback) {
        var self = $(this)

        // ensure store local is ready
        store.local = {}
        
        var xhr = $.ajax({
            method: 'GET',
            url: '/effect/list',
            success: function (plugins) {
                var lplugins = {}
                for (var i in plugins) {
                    var plugin = plugins[i]
                    if (plugin && plugin.patchstorage && plugin.patchstorage.id) {
                        plugin.psid = String(plugin.patchstorage.id)
                        plugin.ps_local_version = (plugin.patchstorage.revision) ? plugin.patchstorage.revision : "0.0"
                    }
                    lplugins[plugin.uri] = plugin
                }

                store.local = $.extend(true, {}, lplugins)
                self.data('pluginsLocalChecked', true)
                callback()
            },
            error: function (xhr, status) {
                if (status == 'abort') return
                store.local = {}
                self.data('pluginsLocalChecked', true)
                callback()
            },
            cache: false,
            dataType: 'json'
        })
        self.data('xhrs').push(xhr)
    },

    getPluginLocalData: function (uri, psid, store, callback) {
        var self = $(this)

        // semi hack - if same, plugin is not isntalled
        if (uri == psid) {
            store.local = {}
            self.data('pluginLocalChecked', true)
            callback()
            return
        }
        
        var xhr = $.ajax({
            url: "/effect/get",
            data: {
                uri: uri,
                version: VERSION
            },
            success: function (data) {
                if (data.patchstorage && data.patchstorage.id) {
                    data.psid = String(data.patchstorage.id)
                    data.ps_local_version = (data.patchstorage.revision) ? data.patchstorage.revision : "0.0"
                }
                store.local = $.extend(true, {}, data)
                self.data('pluginLocalChecked', true)
                callback()
            },
            error: function (xhr, status) {
                if (status == 'abort') return
                store.local = {}
                self.data('pluginLocalChecked', true)
                callback()
            },
            cache: false,
            dataType: 'json'
        })
        self.data('xhrs').push(xhr)
    },
    
    getPluginCloudData: function (psid, store, callback) {
        var self = $(this)

        // no psid - no data to get
        if (!psid) {
            store.cloud = {}
            self.data('pluginCloudChecked', true)
            callback()
            return
        }

        var xhr = $.ajax({
            url: `${PATCHSTORAGE_API_URL}/${psid}`,
            method: 'GET',
            async: true,
            cache: false,
            dataType: 'json',
            success: function (data) {
                store.cloud = $.extend(true, {}, self.patchstorageBox('transformPatch', data))
                self.data('pluginCloudChecked', true)
                callback()
            },
            error: function (xhr, status, error) {
                if (status == 'abort') return
                store.cloud = {}
                self.data('pluginCloudChecked', true)
                callback()
            }
        })
        self.data('xhrs').push(xhr)
    },

    synchronizePluginData: function (plugin) {
        var index = $(this).data('pluginsData')

        if (window.devicePixelRatio && window.devicePixelRatio >= 2) {
            plugin.thumbnail_href = plugin.thumbnail_href.replace("thumbnail", "screenshot")
        }
        
        index[plugin.uri] = plugin
    },

    // TODO: investigate desktop.indexer
    rebuildSearchIndex: function () {
        var plugins = Object.values($(this).data('pluginsData'))
        desktop.resetPluginIndexer(plugins.filter(function (plugin) { return !!plugin.ps_installed_version }))
    },

    findPluginInStack: function (stack, uri = null, psid = null) {
        if (!uri && !psid) {
            return null
        }
        
        var plugin = null

        if (uri !== null) {
            plugin = stack[uri]
        }

        if (!plugin && psid !== null) {
            for (const uri in stack) {
                if (stack[uri].psid === psid){
                    return stack[uri]
                }
            }
        }

        return plugin
    },

    // search all or installed, depending on selected option
    search: function (customRenderCallback) {
        var self = $(this)
        var query = {
            text: self.data('searchbox').val(),
            summary: "true",
            image_version: VERSION,
            bin_compat: BIN_COMPAT,
        }

        // cleanup
        var xhrs = self.data('xhrs')
        for (var i in xhrs) {
            if (xhrs[i].abort) xhrs[i].abort()
            delete xhrs[i]
        }
        xhrs = []
        self.data('pluginsData', {})

        // if installed from patchstorage
        if (self.find('input:checkbox[name=installed]:checked').length)
            return self.patchstorageBox('searchInstalled', true, query, customRenderCallback)

        // if installed from other source
        if (self.find('input:checkbox[name=not-available]:checked').length)
            return self.patchstorageBox('searchInstalled', false, query, customRenderCallback)

        // if not installed from patchstorage
        if (self.find('input:checkbox[name=non-installed]:checked').length)
            return self.patchstorageBox('searchAll', false, query, customRenderCallback)

        // all available plugins
        return self.patchstorageBox('searchAll', true, query, customRenderCallback)
    },

    // search cloud and local plugins, prefer cloud
    searchAll: function (showInstalled, query, customRenderCallback) {
        var self = $(this)
        var store = {local: null, cloud: null}
        var cplugin, lplugin = false

        self.data('pluginsLocalChecked', false)
        self.data('pluginsCloudChecked', false)

        renderResults = function () {

            if (!self.data('pluginsLocalChecked') || !self.data('pluginsCloudChecked'))
                return

            var plugins = []

            for (var i in store.cloud) {                
                cplugin = store.cloud[i]
                lplugin = self.patchstorageBox('findPluginInStack', store.local, cplugin.uri, cplugin.psid)

                if (lplugin && !showInstalled) {
                    continue
                }

                plugin = self.patchstorageBox('mergePluginData', cplugin, lplugin)
                plugins.push(plugin)
            }

            // for all the other plugins that are not in the cloud
            if (showInstalled) {
                for (var uri in store.local) {
                    lplugin = store.local[uri]
                    // if psid used as uri, means this local plugin is in cloud.
                    if (lplugin.psid in store.cloud) {
                        continue
                    }
                    plugin = self.patchstorageBox('mergePluginData', null, lplugin)
                    plugins.push(plugin)
                }
            }

            if (customRenderCallback) {
                customRenderCallback(plugins)
            } else {
                self.patchstorageBox('showPlugins', plugins)
            }

            self.patchstorageBox('rebuildSearchIndex')
        }

        self.patchstorageBox('getCloudPlugins', query, store, renderResults)
        self.patchstorageBox('getLocalPlugins', query, store, renderResults)
    },

    // search cloud and local plugins, show installed only
    searchInstalled: function (fromPatchstorage, query, customRenderCallback) {
        var self = $(this)
        var store = {
            local: null,
            cloud: null
        }
        var cplugin, lplugin = false

        self.data('pluginsLocalChecked', false)
        self.data('pluginsCloudChecked', false)

        renderResults = function () {
            if (!self.data('pluginsLocalChecked') || !self.data('pluginsCloudChecked'))
                return

            var plugins = []
            
            for (var i in store.local) {
                lplugin = store.local[i]
                
                // if ps only, don't show plugins without psid
                if (fromPatchstorage && !lplugin.psid) {
                    continue
                }

                // if non ps, don't show plugins with psid
                if (!fromPatchstorage && lplugin.psid) {
                    continue
                }

                cplugin = self.patchstorageBox('findPluginInStack', store.cloud, null, lplugin.psid)
                plugin = self.patchstorageBox('mergePluginData', cplugin, lplugin)
                
                plugins.push(plugin)
            }

            if (customRenderCallback) {
                customRenderCallback(plugins)
            } else {
                self.patchstorageBox('showPlugins', plugins)
            }

            self.patchstorageBox('rebuildSearchIndex')
        }

        // if not ps, don't reach cloud
        if (!fromPatchstorage) {
            self.data('pluginsCloudChecked', true)
        } else {
            self.patchstorageBox('getCloudPlugins', query, store, renderResults)
        }
        self.patchstorageBox('getLocalPlugins', query, store, renderResults)
    },

    showPlugins: function (plugins) {
        var self = $(this)
        self.patchstorageBox('cleanResults')

        // sort plugins by label
        plugins.sort(function (a, b) {
            a = a.label.toLowerCase()
            b = b.label.toLowerCase()
            if (a > b) {
                return 1
            }
            if (a < b) {
                return -1
            }
            return 0
        })

        var category = {}
        var categories = {
            'All': plugins.length,
            'ControlVoltage': 0,
            'Delay': 0,
            'Distortion': 0,
            'Dynamics': 0,
            'Filter': 0,
            'Generator': 0,
            'MIDI': 0,
            'Modulator': 0,
            'Reverb': 0,
            'Simulator': 0,
            'Spatial': 0,
            'Spectral': 0,
            'Utility': 0
        }
        var cachedContentCanvas = {
            'All': self.find('#patch-content-All')
        }

        var plugin, render
        var factory = function (img) {
            return function () {
                img.css('opacity', 1)
                var top = (parseInt((img.parent().height() - img.height()) / 2)) + 'px'
                // We need to put a padding in image, but slick creates clones of the
                // element to use on carousel, so we need padding in all clones
                var uri = img.parent().parent().parent().parent().attr('mod-uri')
                var clones = $('div.slick-slide[mod-uri="' + uri + '"][mod-role="cloud-plugin"]')
                clones.find('img').css('padding-top', top);
            };
        }

        for (var i in plugins) {
            plugin = plugins[i]
            category = plugin.category[0]
            render = self.patchstorageBox('renderPlugin', plugin)

            if (category && category != 'All' && categories[category] != null) {
                categories[category] += 1
                if (cachedContentCanvas[category] == null) {
                    cachedContentCanvas[category] = self.find('#patch-content-' + category)
                }
                render.clone(true).appendTo(cachedContentCanvas[category])
            }

            render.appendTo(cachedContentCanvas['All'])
        }

        // display plugin count
        self.patchstorageBox('setCategoryCount', categories)
    },

    setCategoryCount: function (categories) {
        var self = $(this)
        self.data('categoryCount', categories)

        for (var category in categories) {
            var tab = self.find('#patchstorage-tab-' + category)
            if (tab.length == 0) {
                continue
            }
            var content = tab.html().split(/\s/)

            if (content.length >= 2 && content[1] == "Utility") {
                content = content[0] + " Utility"
            } else {
                content = content[0]
            }
            tab.html(content + ' <span class="plugin_count">(' + categories[category] + ')</span>')
        }
    },

    renderPlugin: function (plugin) {
        var self = $(this)
        var data = self.patchstorageBox('getPluginInfoData', plugin, false)
        var template = TEMPLATES.patchstorage_plugin
        var rendered = $(Mustache.render(template, data))
        rendered.click(function () {
            self.patchstorageBox('showPluginInfo', plugin.uri, plugin.psid)
        })

        return rendered
    },

    installPlugin: function (plugin, callback) {
        var file = null

        if (plugin.files && Array.isArray(plugin.files)) {
            plugin.files.forEach(function(f) {
                if (f.target && f.target.id == PATCHSTORAGE_TARGET_ID) {
                    file = f
                }
            });
        }

        if (file == null) {
            alert('This plugin/bundle is not supported on your system.')
            return
        }
        
        // long lived notification
        var notification = new Notification('warning')
        var installationMsg = 'Downloading: ' + file.filename
        
        notification.open()
        notification.html(installationMsg)
        notification.type('warning')
        notification.bar(1)

        var trans = new SimpleTransference(file.url, '/effect/install',
        { to_args: { headers:
            { 'Patchstorage-Item' : plugin.psid, 'Patchstorage-Item-Version' : plugin.ps_cloud_version }
        }})

        trans.reauthorizeDownload = desktop.authenticateDevice;

        trans.reportPercentageStatus = function (percentage) {
            notification.bar(percentage*100)

            if (percentage == 1) {
                installationMsg = installationMsg.replace("Downloading", "Installing")
                notification.html(installationMsg)
            }
        }

        trans.reportError = function (reason) {
            console.log(reason)
            queue = []
            callbacks = []
            notification.close()
            new Notification('error', "Could not install plugin: " + reason, 5000)

            desktop.updateAllPlugins()
        }

        trans.reportFinished = function (resp) {
            var result = resp.result

            if (result.ok) {
                notification.html(installationMsg.replace("Installing:", "Done! Installed:"))
                notification.bar(0)
                notification.type('success')
                notification.closeAfter(3000)
            } else {
                // close previous notification
                notification.closeAfter(1000)
                new Notification('error', "Could not install plugin: " + result.error, 5000)
            }

            desktop.updateAllPlugins()

            var bundlename = (result.bundles && result.bundles.length > 0) ? result.bundles[0] : null

            callback(result, bundlename)
        }

        trans.start()
    },

    // TODO: needs some work together with showPluginInfo for better state reloading
    postInstallAction: function (installed, removed, bundlename) {
        var self = $(this)
        // var bundle = LV2_PLUGIN_DIR + bundlename
        // var category, categories = self.data('categoryCount')
        var uri, plugin, oldElem, newElem

        // for (var i in installed) {
        //     uri = installed[i]
        //     plugin = self.data('pluginsData')[uri]

        //     if (!plugin) {
        //         continue
        //     }

        //     plugin.status = 'installed'
        //     plugin.bundles = [bundle]
        //     plugin.ps_local_version = plugin.ps_cloud_version

        //     oldElem = self.find('.cloud-plugin[mod-uri="' + escape(uri) + '"]')
        //     newElem = self.patchstorageBox('renderPlugin', plugin)
        //     oldElem.replaceWith(newElem)
        // }

        for (var i in removed) {
            uri = removed[i]

            if (installed.indexOf(uri) >= 0) {
                continue
            }

            var favoriteIndex = FAVORITES.indexOf(uri)
            if (favoriteIndex >= 0) {
                FAVORITES.splice(favoriteIndex, 1)
                $('#effect-content-Favorites').find('[mod-uri="' + escape(uri) + '"]').remove()
                $('#effect-tab-Favorites').html('Favorites (' + FAVORITES.length + ')')
            }

            // plugin = self.data('pluginsData')[uri]
            // oldElem = self.find('.cloud-plugin[mod-uri="' + escape(uri) + '"]')

            // if (plugin.ps_cloud_version) {
            //     // removing a plugin available on cloud, keep its store item
            //     plugin.status = 'available'
            //     plugin.bundle_name = bundle
            //     delete plugin.bundles
            //     plugin.ps_local_version = null

            //     var pluginData = self.patchstorageBox('mergePluginData', {}, plugin)

            //     newElem = self.patchstorageBox('renderPlugin', pluginData)
            //     oldElem.replaceWith(newElem)

            // } else {
            //     // removing local plugin means the number of possible plugins goes down
            //     category = plugin.category[0]

            //     if (category && category != 'All') {
            //         categories[category] -= 1
            //     }
            //     categories['All'] -= 1

            //     // remove it from store
            //     delete self.data('pluginsData')[uri]
            //     oldElem.remove()
            // }
        }

        // self.patchstorageBox('setCategoryCount', categories)
    },

    getPluginInfoData: function (plugin, full = false) {

        var data = $.extend(true, {}, plugin)

        var basic = {
            uri: data.uri,
            escaped_uri: escape(data.uri),
            comment: (data.comment) ? data.comment.trim() : "No description available",
            has_comment: (data.comment) ? null : "no_description",
            author: data.author,
            screenshot_href: data.screenshot_href,
            thumbnail_href: data.thumbnail_href,
            status: data.status,
            brand: data.brand,
            label: data.label,
            download_count: data.download_count,
            state: data.state,
            tags: data.tags,
            favorite_class: FAVORITES.indexOf(plugin.uri) >= 0 ? "favorite" : "",
        }

        if (full === false) {
            return $.extend(true, {}, basic)
        }
        
        if (data.ports) {
            // formating numbers and flooring ranges up to two decimal cases
            for (var i = 0; i < data.ports.control.input.length; i++) {
                data.ports.control.input[i].formatted = format(data.ports.control.input[i])
            }

            if (data.ports.cv && data.ports.cv.input) {
                for (var i = 0; i < data.ports.cv.input.length; i++) {
                    data.ports.cv.input[i].formatted = format(data.ports.cv.input[i])
                }
            }

            if (data.ports.cv && data.ports.cv.output) {
                for (var i = 0; i < data.ports.cv.output.length; i++) {
                    data.ports.cv.output[i].formatted = format(data.ports.cv.output[i])
                }
            }
        }
        
        var category = data.category[0]

        var package_name = (data.bundle_name) ? data.bundle_name.replace(/\.lv2$/, '') : null
        if (!package_name && data.bundles && data.bundles[0]) {
            package_name = data.bundles[0].replace(/\.lv2$/, '')
        }

        var extensive = {
            name: data.name,
            ports: data.ports,
            link: data.link,
            category: category || "None",
            ps_local_version: data.ps_local_version,
            ps_cloud_version: data.ps_cloud_version,
            plugin_version: (data.plugin_version) ? version(data.plugin_version) : null,
            package_name: package_name,
            uploader: data.uploader
        }

        return $.extend(true, basic, extensive)
    },

    showPluginInfo: function (uri, psid) {
        var self = $(this)
        var result = {
            local: null,
            cloud: null
        }
        
        self.data('pluginCloudChecked', false)
        self.data('pluginLocalChecked', false)

        var showInfo = function () {
            if (!self.data('pluginLocalChecked') || !self.data('pluginCloudChecked'))
                return
            
            var plugin = self.patchstorageBox('mergePluginData', result.cloud, result.local)

            // cleanup
            if (self.data('info')) self.data('info').remove()
            self.data('info', null)

            var metadata = self.patchstorageBox('getPluginInfoData', plugin, true)
            var info = self.data('info')
            
            info = $(Mustache.render(TEMPLATES.patchstorage_plugin_info, metadata))

            // The remove button will remove the plugin, close window and re-render the plugins
            // without the removed one
            if (plugin.ps_local_version || plugin.plugin_version) {
                info.find('.js-install').hide()
                info.find('.js-remove').show().click(function () {
                    // Remove plugin
                    self.data('removePluginBundles')(plugin.bundles, function (resp) {
                        var bundlename = plugin.bundles[0].split('/').filter(function (el) { return el.length != 0 }).pop(0)
                        self.patchstorageBox('postInstallAction', [], resp.removed, bundlename)
                        info.window('close')
                        // remove-only action, need to manually update plugins
                        // TODO: investigate
                        desktop.updatePluginList([], resp.removed)
                        // need a better solution for reloading state
                        self.patchstorageBox('search')
                    })
                })
            } else {
                info.find('.js-remove').hide()
                info.find('.js-install').show().click(function () {
                    self.patchstorageBox('installPlugin', plugin, function (resp, bundlename) {
                        self.patchstorageBox('postInstallAction', resp.installed, resp.removed, bundlename)
                        info.window('close')
                        // need a better solution for reloading state
                        self.patchstorageBox('search')
                    })
                })
            }

            if (plugin.status == 'outdated') {
                info.find('.js-upgrade').show().click(function () {
                    // Upgrade plugin
                    self.patchstorageBox('installPlugin', plugin, function (resp, bundlename) {
                        self.patchstorageBox('postInstallAction', resp.installed, resp.removed, bundlename)
                        info.window('close')
                        // need a better solution for reloading state
                        self.patchstorageBox('search')
                    })
                })
            } else {
                info.find('.js-upgrade').hide()
            }

            info.appendTo($('body'))
            info.window({
                windowName: "Patchstorage Plugin Info"
            })

            info.window('open')
            self.data('info', info)
        }

        self.patchstorageBox('getPluginLocalData', uri || null, psid || null, result, showInfo)
        self.patchstorageBox('getPluginCloudData', psid || null, result, showInfo)
    }
})
