function objectEmpty(obj) {
    for (var _ in obj) return false
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
            windowName: "Patchstorage",
            info: null,
            isMainWindow: true,
            localPlugins: null,
            cloudPlugins: null,
            cloudPluginsLoaded: false,
            localPluginsLoaded: false,
            mergedPlugins: null,
            localPlugin: null,
            cloudPlugin: null,
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
            self.find('input:checkbox[name=other]').prop('checked', false)
            self.find('input:checkbox[name=outdated]').prop('checked', false)
            self.patchstorageBox('search')
        })
        self.find('input:checkbox[name=non-installed]').click(function (e) {
            self.find('input:checkbox[name=installed]').prop('checked', false)
            self.find('input:checkbox[name=other]').prop('checked', false)
            self.find('input:checkbox[name=outdated]').prop('checked', false)
            self.patchstorageBox('search')
        })
        self.find('input:checkbox[name=outdated]').click(function (e) {
            self.find('input:checkbox[name=non-installed]').prop('checked', false)
            self.find('input:checkbox[name=other]').prop('checked', false)
            self.find('input:checkbox[name=installed]').prop('checked', false)
            self.patchstorageBox('search')
        })
        self.find('input:checkbox[name=other]').click(function (e) {
            self.find('input:checkbox[name=installed]').prop('checked', false)
            self.find('input:checkbox[name=non-installed]').prop('checked', false)
            self.find('input:checkbox[name=outdated]').prop('checked', false)
            self.patchstorageBox('search')
        })

        self.find('#patchstorage_update_all').click(function (e) {
            self.data('cloudPlugins', null)
            self.data('localPlugins', null)
            self.data('mergedPlugins', null)
            self.patchstorageBox('search')
        })

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

    transformCloudPlugin: function (p) {
        p.psid = p.id.toString()
        p.cloud_revision = p.revision
        p.name = unescape(p.title)
        p.label = unescape(p.title)
        p.comment = (p.content) ? unescape(p.content) : unescape(p.excerpt)
        p.thumbnail_href = p.artwork.thumbnail_url
        p.screenshot_href = p.artwork.url
        p.plugin_count = p.uids.length
        p.state = p.state.slug
        p.uploader = p.author.slug
        p.status = 'available'

        if (p.uids.length == 1) {
            p.uri = p.uids[0]
        } else {
            p.uri = p.id.toString()
        }

        // check if is supported on this platform
        p.supported = true
        if (p.files && p.files.length > 0) {
            p.supported = false
            p.files.forEach(function(f) {
                if (f.target && f.target.id == PATCHSTORAGE_TARGET_ID) {
                    p.supported = true
                }
            })
        }

        var tags = []

        p.categories.forEach(function(item) {
            var name = item.slug.replace('-', '').toLowerCase()
            if (!tags.includes(name)) tags.push(name)
        })

        p.tags.forEach(function(item) {
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

        p.category = getCategoryFromTags(tags)
        p.tags = tags.join(', ')

        delete p.id
        delete p.artwork
        delete p.author
        delete p.content
        delete p.categories
        delete p.code
        delete p.created_at
        delete p.custom_license_text
        delete p.preview_url
        delete p.self
        delete p.title
        delete p.updated_at
        delete p.slug
        delete p.platform
        delete p.excerpt

        return p
    },

    transformCloudPlugins: function (patches) {
        var self = $(this)
        patches.map((patch, i) => {
            patch = self.patchstorageBox('transformCloudPlugin', patch)
        })
        return patches
    },

    transformLocalPlugin: function (p) {
        var ver = [p.builder, p.microVersion, p.minorVersion, p.release].join('_')
        
        p.psid = (p.patchstorage && p.patchstorage.id) ? String(p.patchstorage.id) : null
        p.local_revision = (p.patchstorage && p.patchstorage.revision) ? p.patchstorage.revision : null
        p.local_version = [p.builder || 0, p.minorVersion, p.microVersion, p.release]
        p.screenshot_href = (p.gui) ? "/effect/image/screenshot.png?uri=" + escape(p.uri) + "&v=" + ver : null
        p.thumbnail_href = (p.gui) ? "/effect/image/thumbnail.png?uri=" + escape(p.uri) + "&v=" + ver : null
        
        if (p.category && p.category.length == 2 && p.category[0] == 'Utility' && p.category[1] == 'MIDI') {
            p.category = ['MIDI',]
        }

        p.status = 'installed'

        return p
    },

    mergePluginsData: function (lPlugin, cPlugin) {
        if (!cPlugin && !lPlugin) {
            return {}
        }

        if (lPlugin == null || lPlugin == undefined || objectEmpty(lPlugin)) {
            return $.extend(true, {}, cPlugin)
        }

        lPlugin.psid = cPlugin.psid
        lPlugin.cloud_revision = cPlugin.cloud_revision
        lPlugin.download_count = cPlugin.download_count
        lPlugin.state = cPlugin.state
        lPlugin.url = cPlugin.url
        lPlugin.uploader = cPlugin.uploader
        lPlugin.tags = cPlugin.tags
        lPlugin.donate_url = cPlugin.donate_url
        lPlugin.source_code_url = cPlugin.source_code_url
        lPlugin.comment_count = cPlugin.comment_count
        lPlugin.like_count = cPlugin.like_count
        
        if (lPlugin.local_revision && lPlugin.cloud_revision && lPlugin.cloud_revision != lPlugin.local_revision) {
            lPlugin.status = 'outdated'
        }

        return lPlugin
    },

    // TODO: freeze navigation when loading
    getCloudPlugins: function (callback) {
        var self = $(this)
        var base = PATCHSTORAGE_API_URL
        var platform_id = PATCHSTORAGE_PLATFORM_ID
        var target_id = PATCHSTORAGE_TARGET_ID
        var url = `${base}?per_page=100&platforms=${platform_id}&targets=${target_id}`
        var page = 1
        var plugins_map = {}
        var cloudPlugins = self.data('cloudPlugins')

        self.data('cloudPluginsLoaded', false)

        // cache
        if (cloudPlugins != null) {
            self.data('cloudPluginsLoaded', true)
            callback()
            return
        }

        var loading = new Notification('info', 'Fetching plugins from Patchstorage...', 7000)

        function getNextPage() {
            var xhr = $.ajax({
                url: url + `&page=${page}`,
                method: 'GET',
                async: true,
                cache: false,
                dataType: 'json',
                success: function (data, status, xhr) {
                    if (!data || data.length < 1) {
                        self.data('cloudPlugins', plugins_map)
                        self.data('cloudPluginsLoaded', true)
                        callback()
                        return
                    }

                    var pages = xhr.getResponseHeader('x-wp-totalpages')
                    var transformed = self.patchstorageBox('transformCloudPlugins', data)
                    
                    for (const plugin of transformed) { 
                        if (plugin.supported) {
                            plugins_map[plugin.uri] = plugin
                        }
                    }

                    if (pages && pages > page) {
                        page++
                        getNextPage()
                    } else {
                        self.data('cloudPlugins', plugins_map)
                        self.data('cloudPluginsLoaded', true)
                        loading.close()
                        callback()
                        return
                    }
                },
                error: function (xhr, status) {
                    if (status == 'abort') return
                    notification.close()
                    new Notification('error', "Connection to Patchstorage failed!", 5000)
                    self.data('cloudPlugins', {})
                    self.data('cloudPluginsLoaded', true)
                    callback()
                    return
                }
            });
            self.data('xhrs').push(xhr)
        }

        getNextPage()
    },

    getLocalPlugins: function (callback) {
        var self = $(this)
        var plugins_map = {}
        var localPlugins = self.data('localPlugins')

        self.data('localPluginsLoaded', false)

        // cache
        if (localPlugins != null) {
            self.data('localPluginsLoaded', true)
            callback()
            return
        }
        
        var xhr = $.ajax({
            method: 'GET',
            url: '/effect/list',
            success: function (plugins) {
                var plugin, transformed = null
                
                for (var i in plugins) {
                    plugin = plugins[i]
                    transformed = self.patchstorageBox('transformLocalPlugin', plugin)
                    plugins_map[plugin.uri] = transformed
                }

                self.data('localPlugins', plugins_map)
                self.data('localPluginsLoaded', true)
                callback()
                return
            },
            error: function (xhr, status) {
                if (status == 'abort') return
                self.data('localPlugins', {})
                self.data('localPluginsLoaded', true)
                callback()
                return
            },
            cache: false,
            dataType: 'json'
        })
        self.data('xhrs').push(xhr)
    },

    mergePlugins: function (lPs, cPs) {
        var self = $(this)

        // cache
        if (self.data('mergedPlugins') != null) {
            return self.data('mergedPlugins')
        }

        // freeze
        self.data('mergedPlugins', null)

        var mPlugins = {}
        var lPlugins = $.extend(true, {}, lPs)
        var cPlugins = $.extend(true, {}, cPs)

        function buildIndex(data) {
            data.index = `${data.comment} ${data.name} ${data.label}  ${data.brand} ${data.uploader}`.toLowerCase()
            return data
        }

        // iterate over cloud plugins
        for (var i in cPlugins) {
            var lPlugin, cPlugin, plugin = null

            var cPlugin = cPlugins[i]

            if (!cPlugin.uids) {
                // nothing to do here
                continue
            }

            // bundle
            if (cPlugin.uids.length > 1) {
                
                // installed bundle
                if (cPlugin.uids[0] in lPlugins) {
                    // all bundle plugins should be installed
                    // show separate plugins
                    cPlugin.uids.forEach(function (uri) {

                        if (uri in lPlugins) {
                            lPlugin = lPlugins[uri]
                            plugin = self.patchstorageBox('mergePluginsData', lPlugin, cPlugin)
                            mPlugins[uri] = buildIndex(plugin)
                            delete lPlugins[uri]
                        }
                    })
                
                // not installed bundle - show sinlge bundle plugin
                } else {
                    cPlugin.status = 'available'
                    mPlugins[`bundle_${cPlugin.psid}`] = buildIndex(cPlugin)
                }

            // plugin
            } else {

                var uri = cPlugin.uids[0]

                // installed plugin - show single plugin
                if (uri in lPlugins) {
                    lPlugin = lPlugins[uri]
                    plugin = self.patchstorageBox('mergePluginsData', lPlugin, cPlugin)
                    mPlugins[uri] = buildIndex(plugin)
                    delete lPlugins[uri]
                
                // not installed plugin - show single plugin
                } else {
                    cPlugin.status = 'available'
                    mPlugins[uri] = buildIndex(cPlugin)
                }

            }
        }

        // iterate over rest local plugins
        for (var uri in lPlugins) {
            var lPlugin = null
            
            lPlugin = lPlugins[uri]

            // removed from patchstorage
            if (lPlugin.local_revision != null) {
                lPlugin.status = 'unavailable'
                mPlugins[uri] = buildIndex(lPlugin)
            // different source
            } else {
                lPlugin.status = 'local'
                mPlugins[uri] = buildIndex(lPlugin)
            }
        }

        self.data('mergedPlugins', mPlugins)

        return mPlugins
    },

    getPluginLocalData: function (uri, psid, status, callback) {
        var self = $(this)

        // no local plugin
        if (uri == null || status == 'available') {
            self.data('localPlugin', {})
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
                var transformed = self.patchstorageBox('transformLocalPlugin', data)
                self.data('localPlugin', transformed)
                callback()
                return
            },
            error: function (xhr, status) {
                if (status == 'abort') return
                self.data('localPlugin', {})
                callback()
                return
            },
            cache: false,
            dataType: 'json'
        })
        self.data('xhrs').push(xhr)
    },
    
    getPluginCloudData: function (uri, psid, status, callback) {
        var self = $(this)

        // no psid means plugin was installed form different source
        if (status == 'unavailable' || status == 'local' || psid == null) {
            self.data('cloudPlugin', {})
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
                var plugin = self.patchstorageBox('transformCloudPlugin', data)
                // if plugin is not supported (e.g. no target file)
                if (plugin.supported) {
                    self.data('cloudPlugin', plugin)
                } else {
                    self.data('cloudPlugin', {})
                }
                callback()
                return
            },
            error: function (xhr, status, error) {
                if (status == 'abort') return
                self.data('cloudPlugin', {})
                callback()
                return
            }
        })
        self.data('xhrs').push(xhr)
    },

    // search all or installed, depending on selected option
    search: function () {
        var self = $(this)
        var query = {
            text: self.data('searchbox').val()
        }

        // cleanup
        var xhrs = self.data('xhrs')
        for (var i in xhrs) {
            if (xhrs[i].abort) xhrs[i].abort()
            delete xhrs[i]
        }
        xhrs = []

        var filterPSAvailable = function (plugin) {
            if (plugin.status == 'available') {
                return false
            }
            return true
        }

        var filterPSInstalled = function (plugin) {
            if (plugin.status == 'installed' || plugin.status == 'outdated') {
                return false
            }
            return true
        }

        var filterPSOutdated = function (plugin) {
            if (plugin.status == 'outdated') {
                return false
            }
            return true
        }
        
        var filterOther = function (plugin) {
            if (plugin.status == 'local' || plugin.status == 'unavailable') {
                return false
            }
            return true
        }

        var filterAll = function (plugin) {
            return false
        }

        if (self.find('input:checkbox[name=non-installed]:checked').length)
            return self.patchstorageBox('searchPlugins', query, filterPSAvailable)

        if (self.find('input:checkbox[name=installed]:checked').length)
            return self.patchstorageBox('searchPlugins', query, filterPSInstalled)

        if (self.find('input:checkbox[name=outdated]:checked').length)
            return self.patchstorageBox('searchPlugins', query, filterPSOutdated)

        if (self.find('input:checkbox[name=other]:checked').length)
            return self.patchstorageBox('searchPlugins', query, filterOther)

        return self.patchstorageBox('searchPlugins', query, filterAll)
    },

    searchPlugins: function (query, shouldSkipPlugin) {
        var self = $(this)

        renderResultsCallback = function () {
            var plugins = []
            var cloudPlugins = self.data('cloudPlugins')
            var localPlugins = self.data('localPlugins')

            // waiting for both local and cloud to populate
            if (self.data('localPluginsLoaded') == false || self.data('cloudPluginsLoaded') == false) {
                return
            }

            var mPlugins = self.patchstorageBox('mergePlugins', localPlugins, cloudPlugins)

            for (var id in mPlugins) {
                var plugin = mPlugins[id]

                // filter
                if (shouldSkipPlugin(plugin)) {
                    continue
                }

                // search
                if (query && query.text && !plugin.index.includes(query.text.toLowerCase()) ) {
                    continue
                }

                plugins.push(plugin)
            }

            self.patchstorageBox('renderPlugins', plugins)
        }

        self.data('localPluginsLoaded', false)
        self.data('cloudPluginLoaded', false)
        self.patchstorageBox('getCloudPlugins', renderResultsCallback)
        self.patchstorageBox('getLocalPlugins', renderResultsCallback)
    },

    renderPlugins: function (plugins) {
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

        for (var i in plugins) {
            plugin = plugins[i]
            category = plugin.category[0]
            render = self.patchstorageBox('renderPluginCard', plugin)

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

    renderPluginCard: function (plugin) {
        var self = $(this)
        var data = self.patchstorageBox('getPluginCardData', plugin, false)
        var template = TEMPLATES.patchstorage_plugin
        var rendered = $(Mustache.render(template, data))
        rendered.click(function () {
            self.patchstorageBox('showPluginInfo', plugin)
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
            { 'Patchstorage-Item' : plugin.psid, 'Patchstorage-Item-Version' : plugin.cloud_revision }
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
        //     plugin.local_revision = plugin.cloud_revision

        //     oldElem = self.find('.cloud-plugin[mod-uri="' + escape(uri) + '"]')
        //     newElem = self.patchstorageBox('renderPluginCard', plugin)
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

            // if (plugin.cloud_revision) {
            //     // removing a plugin available on cloud, keep its store item
            //     plugin.status = 'available'
            //     plugin.bundle_name = bundle
            //     delete plugin.bundles
            //     plugin.local_revision = null

            //     var pluginData = self.patchstorageBox('mergePluginsData', {}, plugin)

            //     newElem = self.patchstorageBox('renderPluginCard', pluginData)
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

    getPluginCardData: function (plugin, full = false) {

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
            brand: data.brand || data.uploader,
            label: data.label,
            download_count: data.download_count,
            state: data.state,
            tags: data.tags,
            favorite_class: FAVORITES.indexOf(plugin.uri) >= 0 ? "favorite" : "",
        }

        if (basic.status == 'available') {
            delete basic.status
        }

        if (plugin.plugin_count && plugin.plugin_count > 1) {
            basic.plugin_count = plugin.plugin_count
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
            url: data.url,
            category: category || "None",
            local_revision: data.local_revision,
            cloud_revision: data.cloud_revision,
            local_version_string: (data.local_version) ? version(data.local_version) : null,
            package_name: package_name,
            uploader: data.uploader,
            donate_url: data.donate_url,
            source_code_url: data.source_code_url,
            like_count: data.like_count,
            comment_count: data.comment_count
        }

        return $.extend(true, basic, extensive)
    },

    showPluginInfo: function (mPlugin) {
        var self = $(this)

        var showInfo = function () {
            var plugin = null
            var cloudPlugin = self.data('cloudPlugin')
            var localPlugin = self.data('localPlugin')

            // waiting for both local and cloud to populate
            if (localPlugin == null || cloudPlugin == null) {
                return
            }
            
            plugin = self.patchstorageBox('mergePluginsData', localPlugin, cloudPlugin)

            // cleanup
            self.data('info', null)

            var metadata = self.patchstorageBox('getPluginCardData', plugin, true)
            var info = self.data('info')
            
            info = $(Mustache.render(TEMPLATES.patchstorage_plugin_info, metadata))

            // The remove button will remove the plugin, close window and re-render the plugins
            // without the removed one
            if (plugin.status == 'installed' || plugin.status == 'outdated' || plugin.status == 'local') {
                info.find('.js-install').hide()
                info.find('.js-remove').show().click(function () {
                    // Remove plugin
                    self.data('removePluginBundles')(plugin.bundles, function (resp) {
                        var bundlename = plugin.bundles[0].split('/').filter(function (el) { return el.length != 0 }).pop(0)
                        self.patchstorageBox('postInstallAction', [], resp.removed, bundlename)
                        info.window('close')
                        // TODO: investigate
                        desktop.updatePluginList([], resp.removed)
                        // TODO: need a better solution for reloading state
                        self.data('localPlugins', null)
                        self.data('mergedPlugins', null)
                        self.patchstorageBox('search')
                    })
                })
            }
            
            if (plugin.status == 'available') {
                info.find('.js-remove').hide()
                info.find('.js-install').show().click(function () {
                    self.patchstorageBox('installPlugin', plugin, function (resp, bundlename) {
                        self.patchstorageBox('postInstallAction', resp.installed, resp.removed, bundlename)
                        info.window('close')
                        // need a better solution for reloading state
                        self.data('localPlugins', null)
                        self.data('mergedPlugins', null)
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
                        self.data('localPlugins', null)
                        self.data('mergedPlugins', null)
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

        self.data('localPlugin', null)
        self.data('cloudPlugin', null)
        self.patchstorageBox('getPluginCloudData', mPlugin.uri, mPlugin.psid, mPlugin.status, showInfo)
        self.patchstorageBox('getPluginLocalData', mPlugin.uri, mPlugin.psid, mPlugin.status, showInfo)
    }
})
