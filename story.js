// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '9beginning';
squiffy.story.id = 'bde17de09c';
squiffy.story.sections = {
	'': {
		'text': "<p>  {if intro=0:<p class=\"stats\">Your HemoCorp reputation is now at {hcAff}.<br/>\n  Your blood level is {blood}ml.<br/>\n  {if hungry=true:You are hungry.<br/>}\n  {if tired=true:You feel tired.<br/>}</p>}</p>",
		'js': function() {
			if (squiffy.get("_section").startsWith(9)) {
			  squiffy.set("intro", 1);
			}
			else {
			  var jsHcAff = squiffy.get("hcAff");
			  if (jsHcAff < 1 && jsHcAff!=null) {
			    squiffy.story.go("9lowRepEnd");
			    }
			  squiffy.set("intro", 0);
			}
		},
		'passages': {
		},
	},
	'9beginning': {
		'text': "<p class=\"intro\">The year is 2100.</p>\n\n<p>  <a class=\"squiffy-link link-passage\" data-passage=\"next1\" role=\"link\" tabindex=\"0\">&gt;&gt;</a></p>",
		'attributes': ["hcAff = 10","blood = 1800","tired = false","rentPaid = false","sampleSent = false","bloodIntro = 0","hungry = true"],
		'passages': {
			'next1': {
				'text': "<p class=\"intro\">Through increasing automation, lack of governmental power, and relentless greed, capital has been so consolidated in the hands of the few that it has ceased to mean anything.</p>\n\n<p>  <a class=\"squiffy-link link-passage\" data-passage=\"next2\" role=\"link\" tabindex=\"0\">&gt;&gt;</a></p>",
			},
			'next2': {
				'text': "<p class=\"intro\">The bulk of the world, with no ability to exchange money for goods, turned to trade. But the ruling class were uninterested in losing the power that their accumulated wealth had brought them.</p>\n\n<p>  <a class=\"squiffy-link link-passage\" data-passage=\"next3\" role=\"link\" tabindex=\"0\">&gt;&gt;</a></p>",
			},
			'next3': {
				'text': "<p class=\"intro\">So, they created a new kind of rich.</p>\n\n<p>  <a class=\"squiffy-link link-section\" data-section=\"titleScreen\" role=\"link\" tabindex=\"0\">&gt;&gt;&gt;&gt;&gt;&gt;</a></p>",
			},
		},
	},
	'titleScreen': {
		'clear': true,
		'text': "<p>  <img src=\"assets/titleCard.png\"/></p>\n<p>  <a class=\"squiffy-link link-section\" data-section=\"dayOne\" role=\"link\" tabindex=\"0\">&gt;&gt;&gt;&gt;&gt;&gt;</a></p>",
		'passages': {
		},
	},
	'dayOne': {
		'clear': true,
		'text': "<p>  <img id=\"base\" class=\"flavor\" src=\"assets/base.png\" style=\"z-index:1\"/>\n  <img id=\"bed\" class=\"flavor\" src=\"assets/inBed.png\" style=\"z-index:10\"/>\n  <img id=\"speaker\" class=\"flavor\" src=\"assets/speakerLines.png\" style=\"z-index:2\"/></p>\n  <p class=\"stats\">Your HemoCorp reputation is now at {hcAff}.<br/>\n  Your blood level is {blood}ml.<br/>\n  {if hungry=true:You are hungry.<br/>}\n  {if tired=true:You feel tired.<br/>}</p>\n\n<p>  You wake up in your HomePod (TM) to the sound of a loud voice, blaring from your HemoCorp (C) SpeakerFriend (TM).</p>\n<p>  <span class=\"sf\">&quot;Good morning, Galar. How is your blood today?&quot;</span></p>\n<p>  <a class=\"squiffy-link link-section\" data-section=\"groan, hcAff-=1\" role=\"link\" tabindex=\"0\">Ignore it.</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"greet, hcAff+=2\" role=\"link\" tabindex=\"0\">Cheerily exclaim, &quot;It&#39;s coursing efficiently, SpeakerFriend, thank you for asking!&quot;</a></p>",
		'attributes': ["hcAff = 10","blood = 1800","tired = false","rentPaid = false","sampleSent = false","bloodIntro = 0","hungry = true","dead = 0"],
		'passages': {
		},
	},
	'groan': {
		'text': "<p>  You groan and put your pillow over your head.</p>\n<p>  You hear a brief whirr. SpeakerFriend replies, this time louder than before.</p>\n<p>  <span class=\"sf\" style=\"font-size:1.5em\">&quot;Good morning, Galar. How is your blood today?&quot;</span></p>\n<p>  <a class=\"squiffy-link link-section\" data-section=\"sleep, hcAff-=2\" role=\"link\" tabindex=\"0\">Try to go back to sleep.</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"greetBad, hcAff-=2\" role=\"link\" tabindex=\"0\">Mumble something about it being fine.</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"greet, hcAff+=1\" role=\"link\" tabindex=\"0\">Clear your throat and say, &quot;It&#39;s coursing efficiently, SpeakerFriend, thank you for asking!&quot;</a></p>",
		'passages': {
		},
	},
	'sleep': {
		'text': "<p>  <img id=\"lesshappy\" class=\"flavor\" src=\"assets/lessHappy.png\" style=\"z-index:6\"/></p>\n<p>  You put your hands over your ears and try to sleep a bit longer, refusing to acknowledge SpeakerFriend.</p>\n<p>  A grating alarm begins to play.</p>\n<p>  <span class=\"sf\" style=\"font-size:1.5em\">&quot;Good morning, Galar. Rising early is the foundation for you to achieve your full potential. How is your blood today?&quot;</span></p>\n<p>  <a class=\"squiffy-link link-section\" data-section=\"sleepMore, hcAff-=5\" role=\"link\" tabindex=\"0\">Not doing it. Seriously.</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"greetWorse, hcAff-=5\" role=\"link\" tabindex=\"0\">Shout, &quot;IT&#39;S FINE, HOW THE FUCK IS YOURS?&quot;</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"greet\" role=\"link\" tabindex=\"0\">Sigh and say, &quot;It&#39;s coursing efficiently, SpeakerFriend, thank you for asking!&quot;</a></p>",
		'passages': {
		},
	},
	'greetBad': {
		'text': "<p>  <img id=\"lesshappy\" class=\"flavor\" src=\"assets/lessHappy.png\" style=\"z-index:6\"/></p>\n<p>  You mumble something like, &quot;Blood&#39;s good, leave itwarraslee...zzz&quot;</p>\n<p>  <span class=\"sf\">&quot;Galar, I was unable to make that out. Could you please repeat yourself?&quot;</span></p>\n<p>  <a class=\"squiffy-link link-section\" data-section=\"sleepMore, hcAff-=5\" role=\"link\" tabindex=\"0\">Just go back to sleep.</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"greetWorse, hcAff-=5\" role=\"link\" tabindex=\"0\">Shout, &quot;IT&#39;S FINE, HOW THE FUCK IS YOURS?&quot;</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"greet\" role=\"link\" tabindex=\"0\">Loudly exclaim, &quot;It&#39;s coursing efficiently, SpeakerFriend, thank you for asking!&quot;</a></p>",
		'passages': {
		},
	},
	'greetWorse': {
		'text': "<p>  <img id=\"unhappy\" class=\"flavor\" src=\"assets/unhappy.png\" style=\"z-index:7\"/>\n  You hear another small whirr.</p>\n<p>  <span class=\"sf\">&quot;Galar, it seems as if there is an altercation happening in your HomePod. Do you need assistance?&quot;</sf></p>\n<p>  <a class=\"squiffy-link link-section\" data-section=\"aptVisit, dead=0\" role=\"link\" tabindex=\"0\">Request assistance.</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"greet\" role=\"link\" tabindex=\"0\">Decline assistance.</a></p>",
		'passages': {
		},
	},
	'sleepMore': {
		'text': "<p>  <img id=\"unhappy\" class=\"flavor\" src=\"assets/unhappy.png\" style=\"z-index:7\"/>\n  {if seen sleep:The alarm gets even louder.}{else:A grating alarm begins to play.}</p>\n<p>  <span class=\"sf\">&quot;Galar, HemoCorp cares about your well-being. We will dispatch a HemoMedic to your location to make sure that your blood is still circulating.&quot;</span></p>\n<p>  <a class=\"squiffy-link link-section\" data-section=\"greet\" role=\"link\" tabindex=\"0\">Tell SpeakerFriend you&#39;re not dead.</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"aptVisit, dead=1\" role=\"link\" tabindex=\"0\">Continue to try to sleep.</a></p>",
		'passages': {
		},
	},
	'greet': {
		'text': "<p>  <img id=\"clothes\" class=\"flavor\" src=\"assets/clothesOn.png\" style=\"z-index:4\"/></p>\n<p>  {if seen greetWorse:<span class=\"sf\">&quot;Thank you for confirming,&quot;</span> says SpeakerFriend. }{if seen sleepMore:<span class=\"sf\">&quot;Here at HemoCorp, we&#39;re always pleased to know that your blood is still circulating,&quot;</span> says SpeakerFriend. }{if seen groan:<span class=\"sf\">&quot;Remember, Galar, early risers have the best opportunities for a successful day!&quot;</span>}{else:<span class=\"sf\">&quot;So great to hear. May your iron be ever high.&quot;</span>}</p>\n<p>  You slide out of bed and throw on the HemoSuit (TM) that you left crumpled on your floor the night before. You glance at your TeleWall (TM) to see what notices you have for the day.</p>\n<p>  SpeakerFriend chimes back in. <span class=\"sf\">&quot;Galar, don&#39;t forget to send your mandatory monthly sample in for testing! As we at HemoCorp always say, &#39;Happiness is only a blood test away.&#39;&quot;</span></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">&gt;&gt;&gt;&gt;&gt;&gt;</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p>  <a class=\"squiffy-link link-passage\" data-passage=\"buyBar\" role=\"link\" tabindex=\"0\">Purchase a food bar for 100ml</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-passage\" data-passage=\"sendSample\" role=\"link\" tabindex=\"0\">Send in monthly sample</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-passage\" data-passage=\"payRent\" role=\"link\" tabindex=\"0\">Pay the rest of your rent</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"leavePod\" role=\"link\" tabindex=\"0\">Leave the HomePod</a></p>",
		'passages': {
			'buyBar': {
				'text': "<p>  {if bloodIntro&lt;2:You walk up to the TeleWall and roll up your sleeve. At the small interface near the tubes, you make your selection. The needle goes straight to the permanent port in your arm, and you see the blood begin to flow.}{else:The needle re-enters your arm and begins extraction.}</p>\n<p>  {if blood&lt;1150:As the blood flows out of you and into the waiting tubes, The edges of your vision darken. You feel a giddy lightness, and the needle retracts. When you look down at the small display, it blinks, &quot;Insufficient blood. Please try again tomorrow.&quot;}{else:After 100ml has been removed, the needle retracts and a paper-wrapped food bar pops out of the slot to your right. You unwrap it and take a big bite. It tastes faintly of oatmeal.}</p>\n  <p class=\"stats\">{if blood &lt;1150:{@hungry=true}}{if blood&lt;1150:Your blood has only decreased by 50ml.<br />}{if blood&lt;1150:{@blood+=50}}\n  Your blood level is {blood}ml.<br />\n  {if hungry:You are still hungry.<br />}{else:You are no longer hungry.<br />}\n  {if blood&lt;1150:{@tired=true}}\n  {if tired=true:You feel tired.}</p>",
				'attributes': ["blood-=100","hungry=false","bloodIntro+=1"],
			},
			'sendSample': {
				'text': "<p>  <img id=\"blood\" class=\"flavor\" src=\"assets/bloodFilled.png\" style=\"z-index:3\"/></p>\n<p>  {if bloodIntro&lt;2:You walk up to the TeleWall and roll up your sleeve. At the small interface near the tubes, you make your selection. The needle goes straight to the permanent port in your arm, and you see the blood begin to flow.}{else:The needle re-enters your arm and begins extraction.}</p>\n<p>  {if blood&lt;1150:As the blood flows out of you and into the waiting tubes, The edges of your vision darken. You feel a giddy lightness, and the needle retracts. When you look down at the small display, it blinks, &quot;Insufficient blood. Please try again tomorrow.&quot;}{else:After 250ml has been removed, you hear a cheerful little &quot;ding.&quot; <p class=\"sf\">&quot;Why, thank you, Galar, for sending in your sample so promptly.&quot;</p>}</p>\n  <p class=\"stats\">{if blood &lt;1150:{@sampleSent = false}}{if blood&lt;1150:Your blood has only decreased by 100ml.<br />}{if blood&lt;1150:{@blood+=150}}\n  Your blood level is {blood}ml.<br />\n  {if blood&lt;1150:{@tired=true}}\n  {if tired=true:You feel tired.}</p>",
				'attributes': ["bloodIntro+=1","blood-=250","sampleSent = true","hcAff+=2"],
			},
			'payRent': {
				'text': "<p>  {if bloodIntro&lt;2:You walk up to the TeleWall and roll up your sleeve. At the small interface near the tubes, you make your selection. The needle goes straight to the permanent port in your arm, and you see the blood begin to flow.}{else:The needle re-enters your arm and begins extraction.}</p>\n<p>  {if blood&lt;1150:As the blood flows out of you and into the waiting tubes, The edges of your vision darken. You feel a giddy lightness, and the needle retracts. When you look down at the small display, it blinks, &quot;Insufficient blood. Please try again tomorrow.&quot;}{else:<img id=\"rentpaid\" class=\"flavor\" src=\"assets/rentPaid.png\" style=\"z-index:9\"/> The blood flows out of you and into the waiting tubes. You begin to feel lightheaded, but the removal finishes and the needle retracts. You&#39;re pretty sure you can&#39;t spend any more blood today.}</p>\n  <p class=\"stats\">{if blood &lt;1150:{@rentPaid = false}}{if blood&lt;1150:Your blood has only decreased by 300ml.<br />}{if blood&lt;1150:{@blood+=250}}\n  Your blood level is {blood}ml.<br />\n  {if blood&lt;1150:{@tired=true}}\n  {if tired=true:You feel tired.}</p>",
				'attributes': ["bloodIntro+=1","blood-=550","rentPaid = true","hcAff+=1"],
			},
		},
	},
	'leavePod': {
		'text': "<p>  {if sampleSent=false:{@hcAff-=1}}\n  {if hungry=true:{@tired=true}}\n  {if blood&lt;1400:{@tired=true}}</p>\n<p>  You hit the button and your apartment doors slide open with a whoosh.</p>\n<p>  After a long wait and an even longer elevator ride, you make it to the ground floor, and step outside.</p>\n  <p id=\"end\">NEXT CHAPTER COMING SOON.</p>\n  <p id=\"followup\">I&#39;ll bet there are other &quot;endings.&quot; Want to play again? Hit the &quot;restart&quot; button in the bottom corner.</p>",
		'attributes': ["bloodIntro+=1"],
		'passages': {
		},
	},
	'aptVisit': {
		'text': "<p>  <img id=\"doors\" class=\"flavor\" src=\"assets/doorsOpen.png\" style=\"z-index:5\"/>\n  <img id=\"emergency\" class=\"flavor\" src=\"assets/emergency.png\" style=\"z-index:8\"/></p>\n<p>  {if dead=0:You&#39;re beyond caring. &quot;Yes. Yes, SpeakerFriend, I need assistance. I cannot bring myself to give a shit about getting out of bed.&quot;}</p>\n<p>  {if dead=0:SpeakerFriend responds: <span class=\"sf\">Assistance is on its way. Please remain calm, Galar.&quot;</span>}</p>\n<p>  Time passes. You get about 15 more minutes of sweet slumber, until you hear your HomePod doors whoosh open.</p>\n<p>  Two large, ruddy men in red HemoSuits come through the doors.</p>\n<p>  &quot;SpeakerFriend sent out an alert about a...&quot; starts the one on the left, squinting at his notes on his HemoWatch (TM).</p>\n<p>  {if dead=1:The one on the right interrupts. &quot;A dead body. Galar ID Alpha, Kilo, Tango, 3, 6, 2.&quot;}\n  {if dead=0:The one on the right chimes in: &quot;An altercation concerning one Galar ID Alpha, Kilo, Tango, 3, 6, 2, and unknown assailant.&quot;}</p>\n<p>  They both pause and look at you uncertainly. You lift your head up from your pillow.</p>\n<p>  <a class=\"squiffy-link link-section\" data-section=\"9yesMe\" role=\"link\" tabindex=\"0\">&quot;Yeah, that&#39;s me.&quot;</a>\n  <br />\n  <br />\n  <a class=\"squiffy-link link-section\" data-section=\"9noNotMe\" role=\"link\" tabindex=\"0\">&quot;Nope, he just left.&quot;</a></p>",
		'passages': {
		},
	},
	'9yesMe': {
		'text': "<p>  <img id=\"gas\" class=\"flavor\" src=\"assets/gasCloud.png\" style=\"z-index:11\"/>\n  {if dead=1:The one on the right looks concerned. &quot;You&#39;re the deceased Galar ID Alpha, Kilo, Tango, 3, 6, 2?&quot;}\n  {if dead=0:The one on the right hardens his stare. &quot;Then where&#39;s the assailant?&quot;}</p>\n<p>  The one on the left shakes his head. &quot;Doesn&#39;t matter. Orders are to take whoever&#39;s here up to HQ for blood tests.&quot;</p>\n<p>  Your sleeping pod starts to look sort of hazy, and you notice the smell of what you think might be... lemons?</p>\n<p>  &quot;You&#39;re coming with me.&quot; The one on the right walks towards you as your vision fades to black.</p>\n  <p id=\"end\">NEXT CHAPTER COMING SOON.</p>\n  <p id=\"followup\">I&#39;ll bet there are other &quot;endings.&quot; Want to play again? Hit the &quot;restart&quot; button in the bottom corner.</p>",
		'passages': {
		},
	},
	'9noNotMe': {
		'text': "<p>  {if dead=0:The one on the right hardens his stare. &quot;Then you must be the unknown assailant.&quot;}\n  {if dead=1:The one on the right looks angry. &quot;Then where&#39;d you put the body?&quot;}</p>\n<p>  The one on the left shakes his head dismissively and walks towards you. &quot;Doesn&#39;t matter {if dead=0:who you are}{else:where}.&quot;</p>\n<p>  Your sleeping pod starts to look sort of hazy, and you notice the smell of what you think might be... fertilizer?</p>\n<p>  &quot;You&#39;re coming with me.&quot; The one on the right walks towards you as your vision fades to black.</p>\n  <p id=\"end\">NEXT CHAPTER COMING SOON.</p>\n  <p id=\"followup\">I&#39;ll bet there are other &quot;endings.&quot; Want to play again? Hit the &quot;restart&quot; button in the bottom corner.</p>",
		'passages': {
		},
	},
	'9lowRepEnd': {
		'text': "<p id=\"end\">NEXT CHAPTER COMING SOON.</p>\n  <p id=\"followup\">I&#39;ll bet there are other &quot;endings.&quot; Want to play again? Hit the &quot;restart&quot; button in the bottom corner.</p>",
		'passages': {
		},
	},
}
})();