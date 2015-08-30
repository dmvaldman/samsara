/* Copyright © 2015 David Valdman */

define(function(require, exports, module) {
    var EventHandler = require('samsara/core/EventHandler');
    var Stream = require('samsara/streams/Stream');
    var ResizeStream = require('samsara/streams/ResizeStream');
    var SizeNode = require('samsara/core/nodes/SizeNode');
    var LayoutNode = require('samsara/core/nodes/LayoutNode');
    var layoutAlgebra = require('samsara/core/algebras/layout');
    var sizeAlgebra = require('samsara/core/algebras/size');

    function SceneGraphNode(object) {
        this.sizeStream = null;
        this.layoutStream = null;

        this.layout = new EventHandler();
        this.size = new EventHandler();

        this.root = null;

        if (object) this.set(object);
    }

    function _getRootNode(){
        if (this.root) return this.root;
        if (this.tempRoot) return _getRootNode.call(this.tempRoot);
        return this;
    }

    SceneGraphNode.prototype.add = function add(object) {
        var childNode;

        if (object._isView){
            if (this.root)
                object._node.root = this.root;
            else if (this.tempRoot)
                object._node.tempRoot = this.tempRoot;
            childNode = object;
        }
        else {
            childNode = new SceneGraphNode(object);
            if (this.tempRoot)
                childNode.tempRoot = this.tempRoot;
            else childNode.root = _getRootNode.call(this);
        }

        childNode.layout.subscribe(this.layoutStream || this.layout);
        childNode.size.subscribe(this.sizeStream || this.size);

        return childNode;
    };

    SceneGraphNode.prototype.set = function set(object) {
        if (object instanceof SizeNode){
            this.sizeStream = ResizeStream.lift(
                function SGSizeAlgebra (objectSpec, parentSize){
                    return (objectSpec)
                        ? sizeAlgebra(objectSpec, parentSize)
                        : parentSize;
                },
                [object, this.size]
            );
        }

        if (!object.commit){
            this.layoutStream = Stream.lift(
                function SGLayoutAlgebra (objectSpec, parentSpec, size){
                    // TODO: bug fix for when successive `start` events are fired downstream
                    if (!parentSpec) return;
                    return (objectSpec)
                        ? layoutAlgebra(objectSpec, parentSpec, size)
                        : parentSpec;
                },
                [object, this.layout, this.size]
            );
        }
        else {
            object.__size.subscribe(this.size);

            this.layout.on('start', function(spec){
                var root = _getRootNode.call(this);
                root.objects[object._id] = object;
                root.specs[object._id] = spec;
            }.bind(this));

            this.layout.on('update', function(spec){
                var root = _getRootNode.call(this);
                root.specs[object._id] = spec;
            }.bind(this));

            this.layout.on('end', function(){
                var root = _getRootNode.call(this);
                delete root.objects[object._id];
                delete root.specs[object._id];
            }.bind(this));

            object.size.on('resize', function(size){
                var root = _getRootNode.call(this);
                root.dirtyObjects.push(object);
            }.bind(this));
        }
    };

    module.exports = SceneGraphNode;
});
