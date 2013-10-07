(function() {

	function Connector(handle, options) {
		if(!options) { options = {}; }
		_.defaults(options, {
			container: document.body
		});

		// Generate new namespace for event bindings
		this._ns = '.'+_.uniqueId('connector-');

		// Initialize
		this.initialize.call(this, handle, options);
	}

	_.extend(Connector.prototype, {
		// Position and dimensions
		position: { left: 0, top: 0 },
		positionStart: { left: 0, top: 0 },
		width: 0, height: 0,

		// Handle properties
		handle: null,
		handlePosition: { left: 0, top: 0 },
		handleProportions: { width: 0, height: 0 },
		
		initialize: function(handle, options) {
			_.bindAll(this, 'update');

			// Expose options
			this.options = options;

			// Calculate handle proportions and offset
			this.handle = handle;
			this.handlePosition = this.handle.offset();
			this.handleProportions = {
				width: this.handle[0].offsetWidth,
				height: this.handle[0].offsetHeight
			};

			// Calculate starting positions
			this.positionStart.left = this.position.left =
				this.handlePosition.left + Math.round(this.handleProportions.width / 2);

			this.positionStart.top = this.position.top =
				this.handlePosition.top + Math.round(this.handleProportions.height / 2);

			// Create the element
			this.create(options);

			// Bind handle events
			this._bindToHandle();
		},

		create: function(options) {
			return this.elem = $('<div/>', {
				'class': 'elbowjs-connector',
				css: {
					left: this.positionStart.left,
					top: this.positionStart.top
				},
				html: '<table><tr><td></td></tr></table>'
			})
			.appendTo(options.container);
		},

		move: function(event, target) {
			var width, height, left, top, minHeight, tmp;

			// Set the target if it has changed
			if(target !== this.target) { 
				this.setTarget(target);
			}

			// Determine new dimensions
			left = this.positionStart.left; top = this.positionStart.top;
			right = event.pageX; bottom = event.pageY;

			// Apply correct position classes
			this._updateClasses(left, top, right, bottom);

			// Adjust for negative-left movement
			if(left > right) { tmp = right; right = left; left = tmp; }
			if(top > bottom) { tmp = bottom; bottom = top; top = tmp; }

			// Set properties
			this.width = right - (this.position.left = left);
			this.height = bottom - (this.position.top = top);

			// If target is supplied, use this to position the table
			if(!target) {
				this.elem.css({
					left: left,
					top: top,
					width: right - left,
					height: bottom - top
				});
			}
		},

		update: function() {
			var left = this.handlePosition.left +  Math.round(this.handleProportions.width / 2),
				top = this.handlePosition.top + Math.round(this.handleProportions.height / 2),
				right = this.target.offset.left + Math.round(this.target.width / 2),
				bottom = this.target.offset.top + Math.round(this.target.height / 2),
				tmp;

			// Apply correct position classes
			this._updateClasses(left, top, right, bottom);

			// Adjust for negative-left movement
			if(left > right) { tmp = right; right = left; left = tmp; }
			if(top > bottom) { tmp = bottom; bottom = top; top = tmp; }

			// Set dimensions
			this.elem.css({
				left: left,
				top: top,
				width: right - left,
				height: bottom - top
			});

		},

		setTarget: function(target) {
			// Unbind from previous target
			this.target && this._unbindFromTarget();

			// Bind/update to new target if an element
			if((this.target = target)) {
				this.update();
			}
		},

		_updateClasses: function(left, top, right, bottom) {
			this.elem.toggleClass('right', left <= right)
				.toggleClass('left', left > right)
				.toggleClass('bottom', top <= bottom)
				.toggleClass('top', top > bottom);
		},

		_bindToHandle: function() {
			var _this = this,
				draggable = this.handle.closest('.ui-draggable');

			draggable.on('drag'+this._ns, function(event, ui) {
				// Update handle properties
				_this.handlePosition = ui.offset;
				_this.handleProportions = {
					width: _this.handle[0].offsetWidth,
					height: _this.handle[0].offsetHeight
				};

				// Update
				_this.update();
			});

			this._handleBindees = [draggable];
		},

		_bindToTarget: function() {
			var _this = this,
				draggable = this.target.element.closest('.ui-draggable');

			draggable.on('drag'+this._ns, function(event, ui) {
				// Update handle properties
				_this.target.offset = ui.offset;
				_this.target.width = _this.target.element[0].offsetWidth;
				_this.target.height = _this.target.element[0].offsetHeight;

				// Update
				_this.update();
			});

			this._targetBindees = [draggable];
		},

		_unbindFromTarget: function() {
			$(this._handleBindees).off(this._ns);
		},

		finalize: function() {
			// If a suitable target was set
			if(this.target) {
				// Track changes to the target/handle
				this._bindToTarget();
				this._bindToHandle();
			}

			// If no target is set... remove the element from the DOM
			else {
				this.elem.remove();
			}

			return !!this.target;
		}
	});


	function DDManager(options) {
		if(!options) { options = {}; }
		_.defaults(options, {

		});

		this.initialize.call(this, options);
	}

	_.extend(DDManager.prototype, {

		connectors: [],

		initialize: function(options) {
			// Bind context to "this" in callbacks
			_.bindAll(this, '_handleCheck');

			// Store options
			this.options = options;

			// Bind handlers
			$(document)
				.on('mousedown', '.anchorable', _.wrap(this._handleMouseDown, this._handleCheck))
				.on('mouseup', _.wrap(this._handleMouseUp, this._handleCheck))
				.on('mousemove', _.wrap(this._handleMouseMove, this._handleCheck));
		},

		_handleCheck: function(handle, event) {
			// If a shift+mousedown occurred, or handling flag is set
			if((event.type === 'mousedown' && event.shiftKey) || this._handling) {
				handle.call(this, event);
			}
		},

		_handleMouseDown: function(event) {
			// Prepare offests
			this.prepareOffsets();

			// Create a new connector instance and push onto stack
			var connector;
			this.connectors.push(
				connector = this.current = new Connector(
					$(event.currentTarget), this.options.connector
				)
			);

			// Set flag
			this._handling = true;
		},

		_handleMouseMove: function(event) {
			var target, intersected, i;

			// Find intersections
			i = this._targets.length; while(target = this._targets[--i]) {
				// Don't compare against the current handle
				if(target.element[0] === this.current.handle[0]) { continue };
					
				// If it intersects, set the target
				if( this.intersects(this.current, target) ) {
					intersected = target; break;
				}
			}

			// Update connector
			this.current.move(event, intersected);

			// Prevent default
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
		},

		_handleMouseUp: function(event) {
			// Set handler flag
			this._handling = false;

			// Finalize the connector element and if false, remove it
			if(!this.current.finalize()) {
				this.connectors.pop();
				this.current = null;
			}
		},

		_targets: [],
		prepareOffsets: function() {
			var elements = $('.anchorable'),
				element, i = elements.length;

			this._targets = [];
			while(--i > -1) {
				element = elements.eq(i);

				this._targets.push({
					element: element,
					offset: element.offset(),
					width: element[0].offsetWidth,
					height: element[0].offsetHeight
				});
			}
		},

		intersects: function(connector, anchorable) {
			var x = connector.position.left + connector.width,
				y = connector.position.top + connector.height,
				l = anchorable.offset.left + Math.round(anchorable.width / 2),
				t = anchorable.offset.top + Math.round(anchorable.height / 2),
				tolerance = 0.4,
				toleranceW = Math.ceil(anchorable.width * tolerance),
				toleranceH = Math.ceil(anchorable.height * tolerance);

			return x >= (l - toleranceW) && x <= (l + toleranceW) && 
				y >= (t - toleranceH) && y <= (t + toleranceH);
		}
	});

	var dd = new DDManager();
}());