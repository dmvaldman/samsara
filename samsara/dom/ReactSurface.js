/* Copyright © 2016 Tim Smith */

define(function(require, exports, module) {
    var Surface       = require('./Surface');
    var render        = require('react-dom').render;
    var createElement = require('react').createElement;
    
    /**
     * ReactSurface roots a new React tree in a SamsaraJS Surface. 
     *
     *
     *
     * @class ReactSurface
     * @extends DOM.Surface
     * @namespace DOM
     * @constructor
     *
     * @param [options] {Object}                      Options
     * @param [options.component] {React Class}       React Class that this surface hosts       
     * @param [options.size] {Number[]}               Size (width, height) in pixels. These can also be `true` or `undefined`.
     * @param [options.classes] {String[]}            CSS classes
     * @param [options.properties] {Object}           Dictionary of CSS properties
     * @param [options.attributes] {Object}           Dictionary of HTML attributes
     * @param [options.origin] {Number[]}             Origin (x,y), with values between 0 and 1
     * @param [options.margins] {Number[]}            Margins (x,y) in pixels
     * @param [options.proportions] {Number[]}        Proportions (x,y) with values between 0 and 1
     * @param [options.aspectRatio] {Number}          Aspect ratio
     * @param [options.opacity=1] {Number}            Opacity
     * @param [options.tagName="div"] {String}        HTML tagName
     * @param [options.enableScroll=false] {Boolean}  Allows a Surface to support native scroll behavior
     * @param [options.roundToPixel=false] {Boolean}  Prevents text-blurring if set to true, at the cost to jittery animation
     */
    function ReactSurface(options) {
      Surface.call(this, options);
    
      // Check for erronious option.  Not an error, just a warning.  
      if (options.content != null) {
        console.log("Warning: Content sent to a ReactSurface constructor.");
      }
      
      // Save the component for rendering
      if (options.component != null) {
        this._component = options.component;
      } else {
        console.log("Warning: No React Component sent to ReactSurface constructor");
        this._component = null;
      }
    
      // create a div and set it as the content. From now on this div will be the subject, not the surface.
      this._div = document.createElement('div');
      this.setContent(this._div);   
    
      // remove method setContent.  It is a noop for a ReactSurface. 
      delete this.setContent;  
    
    };
    
    ReactSurface.prototype = Object.create(Surface.prototype);
    ReactSurface.prototype.constructor = ReactSurface;
    ReactSurface.prototype.elementType = 'div';
    ReactSurface.prototype.elementClass = 'samsara-surface';
    
    ReactSurface.prototype.renderWithProps = function(props) {
      render(createElement(this._component, props), this._div);
    };
    
    module.ReactSurface = ReactSurface;
});
