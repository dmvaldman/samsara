/* Copyright © 2015-2016 David Valdman */

define(function(require, exports, module){
    var tick = require('../core/tick');
    var StreamInput = require('./_StreamInput');
    var StreamOutput = require('./_StreamOutput');
    var SimpleStream = require('./SimpleStream');

    var EVENTS = {
        START : 'start',
        UPDATE : 'update',
        END : 'end',
        SET : 'set',
        LOCK : 'lock',
        UNLOCK : 'unlock'
    };

    /**
     * Stream listens to `start`, `update` and `end` events and
     *  emits `start`, `update` and `end` events.
     *
     *  If listening to multiple sources, Stream emits a single event per
     *  Engine cycle.
     *
     *  @example
     *
     *      var position = new Transitionable([0,0]);
     *      var size = new EventEmitter();
     *
     *      var translationStream = Stream.lift(function(position, size){
     *          var translation = [
     *              position[0] + size[0],
     *              position[1] + size[1]
     *          ];
     *
     *          return Transform.translate(translation);
     *      }, [positionStream, sizeStream]);
     *
     *      translationStream.on('start', function(transform){
     *          console.log(transform);
     *      });
     *
     *      translationStream.on('update', function(transform){
     *          console.log(transform);
     *      });
     *
     *      translationStream.on('end', function(transform){
     *          console.log(transform);
     *      });
     *
     *      position.set([100, 50], {duration : 500});
     *
     * @class Stream
     * @extends Streams.SimpleStream
     * @namespace Streams
     * @param [options] {Object}            Options
     * @param [options.set] {Function}      Custom logic to map the `set` event
     * @param [options.start] {Function}    Custom logic to map the `start` event
     * @param [options.update] {Function}   Custom logic to map the `update` event
     * @param [options.end] {Function}      Custom logic to map the `end` event
     * @constructor
     */

    var counter = 0;
    function Stream(triggers){
        triggers = triggers || {};

        this._input = new StreamInput();
        this._output = new StreamOutput();
        this._numSources = 0;

        this.locked = false;
        this.lockedCounter = 0;

        this._sources = [];
        this._sourceData = [];
        this._subscribeData = [];

        this.id = counter++;

        createComplexStrategy.call(this, triggers);
    }

    function createSimpleStrategy(triggers){
        this._input.off(['start', 'update', 'end', 'set', 'lock', 'unlock']);
        this._output.subscribe(this._input);
    }

    function createComplexStrategy(triggers){
        startCounter = 0;
        var self = this;
        var timesFired = 0;

        var cache;
        var hasTicked = false;
        var hasSentLock = false;
        var hasReceivedEvent = false;
        var hasResolved = false;

        var states = {
            set: false,
            start : false,
            update : false,
            end : false,
            prev : ''
        };

        var resolve = function (data){
            timesFired++;

            if (timesFired > 1) {
                console.log('fired twice', this.id)
            }

            if (hasSentLock){
                this.emit('unlock', this);
                hasSentLock = false;
            }

            var type = collapse(this._sourceData, startCounter);

            if (startCounter > 0){
                // subscribe executed
                if (type === EVENTS.END){
                    type === EVENTS.UPDATE;
                }
                else {
                    if (type !== EVENTS.START)
                        this._output.emit(EVENTS.START, data);
                }
                startCounter = 0;
            }

            if (type) this._output.emit(type, data);

            // console.log(type, data)

            if (startCounter < 0){
                // unsubscribe executed
                if (type === EVENTS.START){
                    type === EVENTS.UPDATE;
                }
                else {
                    if (type !== EVENTS.END)
                        this._output.emit(EVENTS.END, data);
                }
                startCounter = 0;
            }

            hasReceivedEvent = false;
            hasResolved = true;
        }.bind(this);

        this._input.on(EVENTS.SET, function(data){
            if (triggers.set) data = triggers.set(data);
            delay(data);
        });

        this._input.on(EVENTS.START, function(data){
            if (data && data._type){
                startCounter++;
                data = data.value;
            }
            if (triggers.start) data = triggers.start(data);
            delay(data);
        });

        this._input.on(EVENTS.UPDATE, function(data){
            if (triggers.update) data = triggers.update(data);
            states.update = true;
            delay(data);
        });

        this._input.on(EVENTS.END, function(data){
            if (data && data._type){
                startCounter--;
                data = data.value;
            }
            if (triggers.end) data = triggers.end(data);
            states.end = true;
            delay(data);
        });

        this._input.on('subscribe', function(){
            this.emit('dep', this);
        }.bind(this));

        this._input.on('unsubscribe', function(){
            this.emit('undep', this);
        }.bind(this));

        this._input.on('dep', function(dep){
            dep.on('lock', depLock);
            dep.on('unlock', depUnlock);
        });

        this._input.on('undep', function(dep){
            dep.off('lock', depLock);
            dep.off('unlock', depUnlock);
        });

        function depLock(dep){
            if (dep instanceof Stream) {
                self.locked = true;
                self.lockedCounter++;
                if (self.lockedCounter === 1){
                    self._output.emit('lock', self);
                }
            }
        }

        function depUnlock(dep){
            if (dep instanceof Stream) {
                self.lockedCounter--;
                if (self.lockedCounter === 0){
                    self.locked = false;
                    self._output.emit('unlock', self);
                }
            }
        }

        var delay = function delay(data){
            if (data === false) return;
            hasReceivedEvent = true;
            cache = data;

            if (hasTicked && !this.locked){
                resolve.call(this, cache);
            }
        }.bind(this);

        tick.on('tick', function(){
            hasTicked = true;

            if (!this.locked && hasReceivedEvent) {
                resolve.call(this, cache);
            }
        }.bind(this));

        tick.on('end tick', function(){
            timesFired = 0;
            hasTicked = false;
            hasResolved = false;
            // hasReceivedEvent = false;
        });
    }

    Stream.prototype = Object.create(SimpleStream.prototype);
    Stream.prototype.constructor = Stream;

    Stream.prototype.subscribe = function(source){
        var self = this;

        (function(id){
            self._sources.push(source);

            var setHandler = function(){ self._sourceData[id].type = EVENTS.SET; }
            var startHandler = function(){ self._sourceData[id].type = EVENTS.START; }
            var updateHandler = function(){ self._sourceData[id].type = EVENTS.UPDATE; }
            var endHandler = function(){ self._sourceData[id].type = EVENTS.END; }

            self._sourceData.push({
                type: '',
                set: setHandler,
                start: startHandler,
                update: updateHandler,
                end: endHandler
            });

            source.on(EVENTS.SET, setHandler);
            source.on(EVENTS.START, startHandler);
            source.on(EVENTS.UPDATE, updateHandler);
            source.on(EVENTS.END, endHandler);
        })(this._sources.length);

        // if (source.locked) {
        //     this.lockedCounter++;
        //     if (this.lockedCounter === 1){
        //         this.locked = true;
        //         this._output.emit('lock', this);
        //     }
        // }

        return StreamInput.prototype.subscribe.apply(this._input, arguments);
        // if (success) {
        //     // if (source.locked) {
        //     //     this.lockedCounter++;
        //     //     if (this.lockedCounter === 1){
        //     //         this.locked = true;
        //     //         this._output.emit('lock', this);
        //     //     }
        //     // }
        //     this._numSources++;
        //     // if (this._numSources === 2) createComplexStrategy.call(this);
        //     // window.Promise.resolve().then(function(){
        //     //     this.trigger('lock', source);
        //     // }.bind(this));
        // }

        // return success;
    };

    Stream.prototype.onSubscribe = true;

    Stream.prototype.unsubscribe = function(source){
        if (!source){
            for (var i = this._input.upstream.length - 1; i >= 0; i--){
                var source = this._input.upstream[i]
                this.unsubscribe(source);
            }
        }
        else {
            var id = this._sources.indexOf(source);

            if (id < 0) return;

            source.off(EVENTS.SET, this._sourceData[id].set);
            source.off(EVENTS.START, this._sourceData[id].start);
            source.off(EVENTS.UPDATE, this._sourceData[id].update);
            source.off(EVENTS.END, this._sourceData[id].end);

            this._sources.splice(id, 1);
            this._sourceData.splice(id, 1);
        }

        return StreamInput.prototype.unsubscribe.apply(this._input, arguments);
        // if (success) {
            // if (source.locked) {
            //     this.lockedCounter--;
            //     if (this.lockedCounter === 0){
            //         this.locked = false;
            //         this._output.emit('unlock', this);
            //     }
            // }
            // window.Promise.resolve().then(function(){
            //     this.trigger('unlock', source);
            // }.bind(this));

            // this._numSources--;
            // if (this._numSources === 1) createSimpleStrategy.call(this);
        // }

        // return success;
    };

    Stream.prototype.trigger = function(){
        return StreamInput.prototype.trigger.apply(this._input, arguments);
    };

    Stream.prototype.emit = function(){
        return StreamOutput.prototype.emit.apply(this._output, arguments);
    };

    Stream.prototype.on = function(){
        return StreamOutput.prototype.on.apply(this._output, arguments);
    };

    Stream.prototype.off = function(){
        return StreamOutput.prototype.off.apply(this._output, arguments);
    };

    Stream.prototype.isActive = function(){
        return StreamOutput.prototype.isActive.apply(this._output, arguments);
    };

    Stream.prototype.get = function(){
        return StreamOutput.prototype.get.apply(this._output, arguments);
    };

    function collapse(data, startCounter){
        var result = '';
        var hasStart = false;
        var hasEnd = false;
        var hasSet = false;

        for (var i = 0; i < data.length; i++){
            var datum = data[i];
            switch (datum.type){
                case EVENTS.UPDATE:
                    return EVENTS.UPDATE;
                    break;
                case EVENTS.START:
                    hasStart = true;
                    break;
                case EVENTS.SET:
                    hasSet = true;
                    break;
                case EVENTS.END:
                    hasEnd = true;
                    break;
            }
        }

        if (hasStart && !hasEnd) return EVENTS.START;
        else if (hasEnd && hasStart) return EVENTS.UPDATE;
        else if (hasEnd) return EVENTS.END;
        else return EVENTS.SET;
    }

    module.exports = Stream;
});
