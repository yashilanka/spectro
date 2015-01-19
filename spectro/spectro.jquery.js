/**
 * Spectro.js jQuery plugin
 * http://github.com/qrelly/spectro.js
 */
(function ($, undefined) {
	'use strict';

	window.spectro = {
		ELEMENT_CLASS:			'spectro-element',
		ELEMENT_CLASS_ACTIVE:	'spectro-element-active',
		ELEMENT_VOID_CLASS:		'spectro-self-closing',
		DROPZONE_CLASS:			'spectro-dropzone',
		DROPZONE_HOVER_CLASS:	'spectro-dropzone-hover',
		DROPZONE_BEFORE_CLASS:	'spectro-dropzone-before',
		DROPZONE_AFTER_CLASS:	'spectro-dropzone-after',
		$lastDraggedElement: null,
		$lastActiveElement: null // Note: not used so far
	};

	// Helpers
	function clearDropzones ( ) {
		$('.' + window.spectro.DROPZONE_CLASS).remove();
	}

	function isSelfClosing (element) {
		var selfClosingElements = [
			'area', 'base', 'br', 'col', 'command',
			'embed', 'hr', 'img', 'input', 'keygen',
			'link', 'meta', 'param', 'source', 'track',
			'wbr'
		];

		return ($.inArray($(element).prop('tagName').toLowerCase(), selfClosingElements) > -1);
	}

	function freshDummyInsertion ($dummy) {

		// Clear label if inline element
		if ($dummy.hasClass(window.spectro.ELEMENT_VOID_CLASS)) {
			$dummy.text('');
		} else {

			// Select dummy's content if non-void
			var range = document.createRange(),
				selection;

			range.selectNodeContents($dummy.get(0));
			selection = window.getSelection()
			selection.removeAllRanges();
			selection.addRange(range);
		}

		// Focus on dummy
		$dummy.focus();
	}

	// Enables element tree
	$.fn.spectro = function (options) {

		// Skip enabled element
		if ($(this).data('scheme') &&
			$(this).hasClass(window.spectro.ELEMENT_CLASS)) {
			return;
		}
		
		// Settings object
		var settings = $.extend({}, $.fn.spectro.defaults, options),
			scheme = undefined;

		// Check if xml resource passed
		if (settings.scheme instanceof XMLDocument) {
			settings.scheme = settings.scheme.firstChild;
		}

		// Check if scheme is not set
		if (typeof settings.scheme !== undefined) {
			scheme = settings.scheme;
		} else {
			throw new Error('Spectro: invalid structure or *.xml scheme');
		}

		// Helpers
		var $menu = $('spectro-menu')

		if ($menu.length <= 0) {
			$menu = $('<spectro-menu />').appendTo('body');
		}

		var $scheme = $(scheme);

		// Multi-element support
		return $(this).each(function ( ) {

			// Iterate through all children
			$(this).children().each(function ( ) {

				// Recursively apply spectro via updated scheme
				var child = this,
					$child = $(child),
					childScheme = $.fn.spectro.defaults.scheme;

				$scheme.children().each(function ( ) {
					if (this.nodeName.toLowerCase() == child.nodeName.toLowerCase()) { // Bingo!
						childScheme = this;

						return false; // break
					}
				});

				$child.spectro({ scheme: childScheme });
			});

			// Setup element
			var $element = $(this);

			if (isSelfClosing($element)) {
				$element.addClass(window.spectro.ELEMENT_VOID_CLASS);
			}

			$element
			.data('scheme', scheme)
			.attr('data-label', $scheme.attr('spectro-label'))
			.attr('tabindex', 0)
			.addClass(window.spectro.ELEMENT_CLASS)

			// Bind events
			.on('focus.spectro', function (event) {
				var $this = $(this);

				$this.addClass(window.spectro.ELEMENT_CLASS_ACTIVE);

				// Allow live text edit if:
				//   1. This is NOT self-closing element and...
				//   2.1. Editing is not forced by scheme or...
				//   2.1. Last tree child
				if (!$this.hasClass(window.spectro.ELEMENT_VOID_CLASS) &&
					($scheme.attr('spectro-editable') == 'true' || $scheme.children().length <= 0)) {
					$this.attr('contenteditable', 'true');
				}

				// Show menu
				$menu
				.attr('active', true)
				.get(0).setup(this);
			})
			.on('blur.spectro', function (event) {
				var $element = $(this);

				$element
				.removeAttr('contenteditable')
				.removeClass(window.spectro.ELEMENT_CLASS_ACTIVE);
			})
			.on('keydown.spectro', function (event) {
				var $this = $(this);

				event.stopPropagation();

				switch (event.keyCode) {
					case 13: // Enter

						// Prevent default browser behavior
						// clone element instead of <p>, <div>
						// or <br /> insertion
						event.preventDefault();
						event.stopPropagation();

						// Prevent army of empty duplicates
						if ($this.is(':empty')) {
							return;
						}

						var $clone = $element
						.clone()
						.html('')
						.removeClass(window.spectro.ELEMENT_CLASS)
						.removeClass(window.spectro.ELEMENT_CLASS_ACTIVE)
						.spectro({ scheme: scheme });

						$this.after($clone);
						$clone.focus();

						break;

					case 46: // Delete

						// Delete self-closing or empty (but non-root) elements
						if ($this.hasClass(window.spectro.ELEMENT_VOID_CLASS) ||
							($this.is(':empty') && $this.parent().hasClass(window.spectro.ELEMENT_CLASS))) {
							$this.parent().focus();
							$this.remove();
						}

						break;
				}
			})
			.on('paste.spectro', function (event) {

				// Allow plain text insertion only 
				event.preventDefault();
				event.stopPropagation();

				document.execCommand('insertHTML', false, event.originalEvent.clipboardData.getData('text/plain'));
			})
			.on('dragover.spectro', function (event) {
				var $dummy = window.spectro.$lastDraggedElement,
					$target = $(this),
					$parent = $target.parent();

				// Allow new element append only
				if ($dummy === null) {
					return;
				}

				// Try adding after or before siblings
				if ($parent.accepts($dummy)) {

					// Create before and after dropzones
					$([ window.spectro.DROPZONE_BEFORE_CLASS,
						window.spectro.DROPZONE_AFTER_CLASS ]).each(function ( ) {

						// TODO: Move to <spectro-dropzone> web component
						var parentPadding = {
								right: parseInt($parent.css('padding-right')),
								left: parseInt($parent.css('padding-left'))
							},
							targetPadding = {
								top: parseInt($target.css('padding-top')),
								bottom: parseInt($target.css('padding-bottom'))
							};

						$('<div />')
						.append('<hr />')
						.addClass(window.spectro.DROPZONE_CLASS)
						.addClass(this)
						.css({
							top: $target.offset().top,
							left: $parent.offset().left,
							width: $parent.width() + parentPadding.left + parentPadding.right,
							height: $target.height() + targetPadding.top + targetPadding.bottom
						})
						.appendTo('body')
						.on('dragover', function (event) {
							$(this).addClass(window.spectro.DROPZONE_HOVER_CLASS);
						})
						.on('dragleave', function (event) {
							$(this).removeClass(window.spectro.DROPZONE_HOVER_CLASS);
						})
						.on('dragover dragenter', function (event) {
							event.preventDefault();
							event.stopPropagation();
						})
						.on('drop', function (event) {
							event.preventDefault();

							if ($(this).hasClass(window.spectro.DROPZONE_BEFORE_CLASS)) {
								$target.before($dummy);
							} else if ($(this).hasClass(window.spectro.DROPZONE_AFTER_CLASS)) {
								$target.after($dummy);
							}

							freshDummyInsertion($dummy);

							// Clear stuff
							$parent.removeClass(window.spectro.ELEMENT_CLASS_ACTIVE);

							clearDropzones();
						});
					});
				} else if ($target.accepts($dummy)) { // Otherwise append directly
					$target.addClass(window.spectro.ELEMENT_CLASS_ACTIVE);

					// Show 'copy here' cursor
					event.preventDefault();
				}
			})
			.on('dragenter.spectro', function (event) {
				event.stopPropagation();

				clearDropzones();
			})
			.on('dragleave.spectro', function (event) {
				$element.removeClass(window.spectro.ELEMENT_CLASS_ACTIVE);
			})
			.on('drop.spectro', function (event) {
				var $dummy = window.spectro.$lastDraggedElement,
					$this = $(this);

				if ($dummy === null) {
					return;
				}

				// Add dummy directly to the element
				if ($this.accepts($dummy)) {
					$this.append($dummy).removeClass(window.spectro.ELEMENT_CLASS_ACTIVE);

					freshDummyInsertion($dummy);
				}
			});
		});
	};

	// Check if active spectro element accepts set element
	$.fn.accepts = function (element) {
		var $activeScheme = $($(this).data('scheme')),
			$element = $(element),
			$elementScheme = $($element.data('scheme')),
			nodeName = $element.prop('nodeName').toLowerCase(),
			accepts = false;

		$activeScheme.children().each(function ( ) {
			if (this.nodeName === nodeName &&
				$(this).attr('spectro-label') === $elementScheme.attr('spectro-label')) {
				return accepts = true; // break
			}
		});

		return accepts;
	};

	// Default settings
	$.fn.spectro.defaults = {
		scheme: undefined,
		enabled: true
	};
})(jQuery);