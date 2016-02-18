define(function (require, exports, module) {
    var Samsara = require('samsara');
    var View = Samsara.View;
    var Transform = Samsara.Transform;
    var Transitionable = Samsara.Transitionable;
    var Wedge = require('./Wedge');

    var App = View.extend({
        defaults: {
            sides: 6
        },
        initialize: function (options) {
            // Animation parameter
            this.swivel = new Transitionable(0);

            // Save a reference for a centered node
            var centerNode = this.add({align: [.5, .5]});

            // Create wedges to form the logo and
            // add them to the centered node
            var rotation = 0;
            for (var index = 0; index < options.sides; index++) {
                var wedge = new Wedge({
                    angle: 2 * Math.PI / options.sides
                });

                // The wedge now listens to changes in swivel
                wedge.input.subscribe(this.swivel);

                // Add the wedge to the render tree with a rotation
                centerNode
                    .add({transform: Transform.rotateZ(rotation)})
                    .add(wedge);

                rotation += 2 * Math.PI / options.sides;
            }
        },
        // Animate the logo
        play: function () {
            this.swivel.loop([
                [4 * Math.PI, {duration: 30000, curve: 'easeInOut'}],
                [0, {duration: 30000, curve: 'easeInOut'}]
            ]);
        },
        // Pause the animation
        pause: function () {
            this.swivel.halt();
        }
    });

    module.exports = App;
});
