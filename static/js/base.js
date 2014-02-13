(function() {

    if (typeof String.prototype.startsWith != 'function') {
        // see below for better implementation!
        String.prototype.startsWith = function (str){
            return this.indexOf(str) == 0;
        };
    }

    if (!window.location.href.startsWith('http://10.2.58.115:8000') &&
        !window.location.href.startsWith('http://10.2.58.115') &&
        !window.location.href.startsWith('http://127.0.0.1:8000')) {
            window.location.href = 'http://10.2.58.115/';
    }

    var NavView = Backbone.View.extend({
        events: {
            'click a': 'click_a'
        },

        click_a: function(e) {
            //console.log('click', e, e.currentTarget);

            var $this = $(e.currentTarget),
                href = $this.attr('href'),
                protocol = $this.protocol + '//';

            if (href.slice(protocol.length) !== protocol) {
                e.preventDefault();
                router.navigate(href, true);
            }
        },

        debug: function(info) {
            $debug = this.$el.find('.debug');
            $debug.stop(true, true).html(info).show(
                100,
                function() {
                    $(this).delay(1000).hide(100);
                }
            )
        },

        active: function(url) {
            this.debug(url);

            this.$el.find('li').removeClass('active');
            $parent = this.$el.find('a[href="' + url + '"]').parent();
            if ($parent) $parent.addClass('active');
        }
    });

    var navView = new NavView({el: $('.nav')});

    var MainView = Backbone.View.extend({
        initialize: function() {
            this.panels = {};
            this.current_panel = undefined;
        },

        load: function(panel_name) {
            var nav_cover = $('.nav ._cover'),
                main_cover = $('.main ._cover');

            var panel = this.panels[panel_name],
                view = this;
            console.log('mainView start loading', panel_name);

            /* first unload, then load */

            /* step 1. show cover */
            nav_cover.show();
            main_cover.show();

            var load_process = function() {
                panel.load(function() {
                    nav_cover.hide();
                    main_cover.hide();

                    panel.show();

                    /* step 4. reset current_panel */
                    view.current_panel = panel;
                });
            }

            /* step 2. unload current panel (if has) */
            if (view.current_panel) {
                console.log('has current_panel');
                view.current_panel.hide();

                view.current_panel.unload(function() {

                    /* step 3. process target panel */
                    load_process();
                });

            } else {

                /* step 3. process target panel */
                load_process();
            }

        }
    });

    var mainView = new MainView({el: $('.main')});

    var PanelView = Backbone.View.extend({
        hide: function(cb) {
            this.$el.hide();

            if (cb) cb();
        },

        show: function() {
            this.$el.stop(true, true).fadeIn(300);
        },

        load: function(cb) {
            console.log('default load');

            if (cb) cb();
        },

        unload: function(cb) {
            console.log('default unload');

            if (cb) cb();
        }
    });

    var HomePanelView = PanelView.extend({
    });

    mainView.panels['home'] = new HomePanelView({el: $('.panel.home')});

    var IPsPanelView = PanelView.extend({

        load: function(cb) {
            var view = this;

            $.ajax({
                url: '/api/ips',
                success: function(json) {
                    view.$el.find('.ips_data').html(JSON.stringify(json));

                    if (cb) cb();
                }
            });
        }
    });

    mainView.panels['ips'] = new IPsPanelView({el: $('.panel.ips')});

    var MonitorPanelView = PanelView.extend({
        load: function(cb) {
            var view = this;

            $.ajax({
                url: '/api/monitor',
                data: {action: 'load'},
                success: function() {
                    setTimeout(function() {
                        view.$el.find('img.camera').attr('src', 'http://10.2.58.115:8090/?action=stream');
                        if (cb) cb();
                    }, 500)

                }
            });

        },

        unload: function(cb) {
            console.log('unload monitor');
            var view = this;

            $.ajax({
                url: '/api/monitor',
                data: {action: 'unload'},
                success: function() {
                    view.$el.find('img.camera').attr('src', 'http://placehold.it/440X330');

                    if (cb) cb();
                }
            });

            if (cb) cb();
        }
    });

    mainView.panels['monitor'] = new MonitorPanelView({el: $('.panel.monitor')});

    var PhotosPanelView = PanelView.extend({
    });

    mainView.panels['photos'] = new PhotosPanelView({el: $('.panel.photos')});

    var AuthView = Backbone.View.extend({
        events: {
            'keypress input[name="key"]': 'input_keypress'
        },

        input_keypress: function(e) {
            console.log(e.charCode);
            if (e.charCode !=  13) return;

            var data = {key: $(e.currentTarget).val()};
            $.ajax({
                url: '/api/auth',
                method: 'POST',
                data: data,
                success: function() {
                    console.log('auth success');
                    router.navigate('/', true);
                }
            })
        }
    })

    var authView = new AuthView({el: $('.auth_wrapper')});


    var Router = Backbone.Router.extend({
        routes: {
            '': 'home',
            'auth': 'auth',
            'logout': 'logout',
            'ips': 'ips',
            'photos': 'photos',
            'monitor': 'monitor'
        },

        init: function(cb) {
            $.ajax({
                url: '/api/auth',
                method: 'GET',
                success: function(json) {
                    console.log(json);
                    if (json.is_authenticated) {
                        $('.auth_wrapper').hide();
                        $('.body_wrapper').show();

                        if (cb) cb();
                    } else {
                        router.navigate('/auth', true);
                    }
                }
            });
        },

        home: function() {
            console.log('home');

            this.init(function() {
                navView.active('/');
                mainView.load('home');
            });
        },

        auth: function() {
            $('.body_wrapper').hide();
            $('.auth_wrapper').show();
        },

        logout: function() {
            $.ajax({
                url: '/api/logout',
                method: 'GET',
                success: function() {
                    router.navigate('/auth', true);
                }
            })
        },

        ips: function() {
            this.init(function() {
                navView.active('/ips');
                mainView.load('ips');
            });
        },

        monitor: function() {
            this.init(function() {
                navView.active('/monitor');
                mainView.load('monitor');
            });
        },

        photos: function() {
            this.init(function() {
                navView.active('/photos');
                mainView.load('photos');
            });
        },
    })

    router = new Router();

    Backbone.history.start({pushState: true});


    /*
    $(document).on('click', 'a:not([data-bypass])', function (e) {

        var href = $(this).attr('href');
        var protocol = this.protocol + '//';

        if (href.slice(protocol.length) !== protocol) {
            e.preventDefault();
            router.navigate(href, true);
        }
    });
    */

})();
